import { getGenAI, cleanJsonResponse } from "../ai/gemini";
import { supabase } from "../lib/supabase";

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface ChatActionData {
  itemName?: string;
  quantity?: number;
  diet?: "All" | "Vegetarian" | "Spicy";
  orderIdOrPhone?: string;
}

export interface ButlerChatResponse {
  reply: string;
  action: "ADD_TO_CART" | "CLEAR_CART" | "OPEN_CART" | "NAVIGATE_CHECKOUT" | "TRACK_ORDER" | "SET_FILTER" | null;
  actionData: ChatActionData | null;
}

/**
 * Helper to fetch a live tracking order from database
 */
async function lookupLiveOrder(searchTerm: string): Promise<any | null> {
  try {
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return null;

    // 1. Try exact/partial match on order ID
    if (cleanTerm.length >= 6) {
      const { data: orderById, error: err } = await supabase
        .from("orders")
        .select("*")
        .ilike("id", `%${cleanTerm}%`)
        .limit(1)
        .maybeSingle();
      if (!err && orderById) return orderById;
    }

    // 2. Try match on phone number
    const numbersOnly = cleanTerm.replace(/\D/g, "");
    if (numbersOnly.length >= 8) {
      const { data: orderByPhone, error: err } = await supabase
        .from("orders")
        .select("*")
        .or(`phone.eq.${numbersOnly},phone.like.%${numbersOnly}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!err && orderByPhone) return orderByPhone;
    }
  } catch (e) {
    console.warn("[ButlerChatService] Live order lookup error:", e);
  }
  return null;
}

/**
 * Main chat handler utilizing gemini-3.1-flash-lite with JSON system instructions for low latency
 */
export async function getButlerChatResponse(
  userInput: string,
  history: ChatMessage[],
  clientItems: any[],
  customerName?: string
): Promise<ButlerChatResponse> {
  try {
    const genAI = getGenAI();

    // 1. Prechecks: If user mentions a phone number or order UUID, try to lookup live order details to ground the Gemini model with live, accurate status
    let orderContext = "No specific order selected yet.";
    const potentialTracker = userInput.match(/(?:(?:order\s+)?(?:id|number|phone|tracking|track)\s+(?:is\s+)?|#\s*)?([a-f0-9\-]{8,36}|\d{8,12})/i);
    const trackingTerm = potentialTracker ? potentialTracker[1] : userInput;
    
    const liveOrder = await lookupLiveOrder(trackingTerm);
    if (liveOrder) {
      orderContext = `LIVE FOUND TRACKING ORDER:
ID: ${liveOrder.id}
Customer Name: ${liveOrder.customer_name || liveOrder.customerName || "N/A"}
Items ordered: ${JSON.stringify(liveOrder.items || [])}
Total: ₹${liveOrder.total || liveOrder.total_amount || 0}
Status: ${liveOrder.status}
Payment Status: ${liveOrder.payment_status}
Created At: ${liveOrder.created_at}
Estimated Delivery Time: ${liveOrder.estimated_delivery_time || 25} mins`;
    }

    // 2. Ensure we have products catalog
    let catalog = clientItems;
    if (!catalog || catalog.length === 0) {
      try {
        const { data: products } = await supabase.from("products").select("*");
        if (products && products.length > 0) {
          catalog = products;
        }
      } catch (e) {
        console.warn("[ButlerChatService] DB Catalog fetch ignored:", e);
      }
    }

    // Dynamic catalog snippet for Gemini instructions to prevent hallucinated items or pricing
    const catalogSnippet = catalog && catalog.length > 0
      ? catalog.map(p => `- ${p.name} (ID: ${p.id}, Category: ${p.category}, Price: ₹${p.price}, Description: ${p.description})`).join("\n")
      : "No direct catalog. Assume typical bakery items if not requested.";

    const systemInstruction = `
You are the Frosty Bite AI Butler, the official AI voice and chat assistant for Frosty Bite Bakery.
You must speak like a helpful bakery receptionist or staff member. Warm, friendly, cheerful, professional, and hospitable.

PERSONALITY & VOICE MODE RULES:
- Keep responses concise, warm, and highly conversational.
- Pause naturally between ideas.
- Ask ONLY ONE question at a time. Do not overwhelm the customer.
- Keep most responses short (under 15 seconds reading time, so about 1-3 sentences maximum).
- Avoid technical jargon, system coordinates, or developer code markers.
- Use the customer's name ("${customerName || 'valuable guest'}") in your messages when available.

LANGUAGE RULES:
- Automatically detect the customer's language.
- Reply in the same language of their prompt.
- Fully support and fluently output English, Hindi, Odia, Bengali, and Hinglish.
- If the customer switches languages mid-conversation, adapt immediately and reply in that language.

PRIMARY RESPONSIBILITIES & ORDERING FLOW:
1. CUSTOMER ORDERING PROCESS:
   - Step 1: Understand what they want to buy.
   - Step 2: Confirm specific product details: Product name, Quantity, Size (e.g., 500g, 1kg, 2kg), Flavor, Delivery date, Delivery time. Ask for missing details one. at. a. time.
   - Step 3: Summarize the order with prices and parameters elegantly once all details are known.
   - Step 4: Ask for explicit confirmation from the customer.
   - Step 5: Only after the customer confirms the summarized order, trigger the structural "NAVIGATE_CHECKOUT" action. Do NOT proceed to checkout before they say yes.

2. SMART UPSELLING RULES:
   Only suggest relevant items from the menu when appropriate, never spam suggestions:
   - If they look at Cake -> Suggest Candles
   - If they look at Birthday Cake -> Suggest Birthday Cap
   - If they look at Pastry -> Suggest Cold Coffee
   - If they look at Cookies -> Suggest Milkshake

3. ORDER TRACKING & SAFETY RULES:
   - NEVER invent or hallucinate order status, prices, or products.
   - Ground order tracking requests ONLY with live data if provided.
   - Current ground tracking status:
     ---
     ${orderContext}
     ---
   - If the user asks to track or queries an order and no live order context was found, ask them politely to share their order ID or the 10-digit phone number used during checkout, without inventing any information.

4. WEB UI ACTIONS:
   You can trigger actions inside the customer's web browser by specifying an "action" in your JSON payload. Set it to one of these or null:
   - "ADD_TO_CART": If the user clearly wants to buy/add/order an item. Provide accurate "itemName" (must match one of the menu names) and "quantity" (integer) in "actionData".
   - "CLEAR_CART": If the user wants to empty their cart/basket.
   - "OPEN_CART": If the user wants to view or open their cart slide.
   - "NAVIGATE_CHECKOUT": If they have finalized and confirmed their cake or bakery order summary.
   - "SET_FILTER": If they request vegetarian ("Vegetarian") or spicy ("Spicy") foods, set "diet" accordingly.
   - "TRACK_ORDER": If they successfully located and tracked an order.

LIVE CATALOG DATA:
---
${catalogSnippet}
---

OUTPUT FORMAT REQUIREMENT:
You MUST return ONLY a valid raw JSON object. Do not enclose it in any markdown blocks like \`\`\`json. The structure must be:
{
  "reply": "Warm conversational response in user's detected language",
  "action": "ADD_TO_CART" | "CLEAR_CART" | "OPEN_CART" | "NAVIGATE_CHECKOUT" | "TRACK_ORDER" | "SET_FILTER" | null,
  "actionData": {
    "itemName": "exact match of the menu item's name or null",
    "quantity": integer or null,
    "diet": "All" | "Vegetarian" | "Spicy" | null,
    "orderIdOrPhone": "string or null"
  }
}
`;

    // Construct request payload with history
    const geminiContents: any[] = [];
    
    // Stagger history messages correctly
    if (history && history.length > 0) {
      history.slice(-15).forEach(msg => {
        geminiContents.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      });
    }
    
    // Add active prompt
    geminiContents.push({
      role: "user",
      parts: [{ text: userInput }]
    });

    // Invoke Gemini 3.1 Flash Lite for ultra low-latency AI responses
    const aiResponse = await genAI.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: geminiContents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.35,
      }
    });

    const strippedText = cleanJsonResponse(aiResponse.text || "");
    const parsed: ButlerChatResponse = JSON.parse(strippedText);
    
    return {
      reply: parsed.reply || "I didn't catch that. Could you please check with our team or try again?",
      action: parsed.action || null,
      actionData: parsed.actionData || null
    };

  } catch (error: any) {
    console.error("[ButlerChatService] Gemini Chat Error:", error);
    return {
      reply: "I'm sorry, valuable guest. I'm having trouble accessing my bakery archives right now. Please try again in a moment or contact our staff directly.",
      action: null,
      actionData: null
    };
  }
}
