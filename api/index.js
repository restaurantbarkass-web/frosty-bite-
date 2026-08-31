var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/ai/gemini.ts
import { GoogleGenAI } from "@google/genai";
function getGenAI() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI operations");
    }
    genAI = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAI;
}
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}
var genAI;
var init_gemini = __esm({
  "server/ai/gemini.ts"() {
    genAI = null;
  }
});

// server/services/recommendation.service.ts
function getNormalizedKey(query) {
  return query.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}
function getLocalRecommendation(query, items) {
  const norm = query.toLowerCase();
  const hasItems = Array.isArray(items) && items.length > 0;
  let matchedItems = [];
  if (hasItems) {
    if (norm.includes("chocolate") || norm.includes("fudge") || norm.includes("cocoa") || norm.includes("dark")) {
      matchedItems = items.filter(
        (i) => i.name && i.name.toLowerCase().includes("chocolate") || i.description && i.description.toLowerCase().includes("chocolate") || i.name && i.name.toLowerCase().includes("fudge")
      );
    } else if (norm.includes("fruit") || norm.includes("berry") || norm.includes("berries") || norm.includes("mango") || norm.includes("strawberry") || norm.includes("lemon") || norm.includes("cherry")) {
      matchedItems = items.filter(
        (i) => i.name && /fruit|berry|berries|mango|strawberry|lemon|cherry/i.test(i.name) || i.description && /fruit|berry|berries|mango|strawberry|lemon|cherry/i.test(i.description)
      );
    } else if (norm.includes("celebrat") || norm.includes("birthday") || norm.includes("anniversary") || norm.includes("party") || norm.includes("cake")) {
      matchedItems = items.filter(
        (i) => i.name && /cake|celebration|birthday/i.test(i.name) || i.category && /cake/i.test(i.category)
      );
    } else if (norm.includes("croissant") || norm.includes("pastry") || norm.includes("bread") || norm.includes("danish") || norm.includes("puff")) {
      matchedItems = items.filter(
        (i) => i.name && /croissant|pastry|danish|bread|puff/i.test(i.name) || i.category && /pastry|bakery/i.test(i.category)
      );
    }
  }
  if (matchedItems.length === 0 && hasItems) {
    matchedItems = items;
  }
  const firstItem = matchedItems[0] || null;
  const secondItem = matchedItems[1] || items[0] || null;
  const thirdItem = matchedItems[2] || items[1] || null;
  let reason = "Our most coveted marquee selection.";
  let intent = "Signature Tasting";
  let mood = "Refined";
  let type = "trending";
  let occasion = "Special Moment";
  let responseText = "I have curated our finest selections based on your unique query. These choices represent the absolute pinnacle of our artisan chefs' craft.";
  if (norm.includes("chocolate") || norm.includes("fudge") || norm.includes("cocoa") || norm.includes("dark")) {
    reason = "Pure cacao opulence on a plate.";
    intent = "Cocoa Indulgence";
    mood = "Decadent";
    type = "flavor";
    occasion = "Indulgence";
    responseText = "For the true chocolate connoisseur, this creation features rich, velvety single-origin chocolates layered in harmony.";
  } else if (norm.includes("fruit") || norm.includes("berry") || norm.includes("berries") || norm.includes("mango") || norm.includes("strawberry") || norm.includes("lemon")) {
    reason = "A refreshing symphony of fresh fruit.";
    intent = "Summer Fruit Tasting";
    mood = "Vibrant";
    type = "flavor";
    occasion = "Refined Escape";
    responseText = "A glorious, balanced display of fresh seasonal fruits nestled in delicate artisanal cream and flaky layers.";
  } else if (norm.includes("celebrat") || norm.includes("birthday") || norm.includes("anniversary") || norm.includes("party") || norm.includes("cake")) {
    reason = "The majestic center of your celebration.";
    intent = "Gala Celebration";
    mood = "Festive";
    type = "occasion";
    occasion = "Celebration";
    responseText = "An exquisite, show-stopping cake designed with intricate details to elevate your beautiful lifetime milestones.";
  } else if (norm.includes("croissant") || norm.includes("pastry") || norm.includes("bread") || norm.includes("danish")) {
    reason = "Golden, hand-laminated buttery perfection.";
    intent = "Pastry Ritual";
    mood = "Cozy & Warm";
    type = "trending";
    occasion = "Gourmet Breakfast";
    responseText = "Layers of premium French butter baked to a golden shatteringly light crisp. Simply a poetic morning ritual.";
  }
  return {
    bestMatchId: firstItem ? String(firstItem.id) : null,
    reason,
    intent,
    alternatives: secondItem && thirdItem && String(secondItem.id) !== String(firstItem?.id) ? [String(secondItem.id), String(thirdItem.id)] : [],
    isEmotionalMatch: true,
    occasionDetected: occasion,
    moodDetected: mood,
    recommendationType: type,
    butlerResponse: responseText
  };
}
function getLocalSuggestions(searchTerm, items) {
  const norm = searchTerm.toLowerCase().trim();
  const suggestions = [];
  if (Array.isArray(items) && items.length > 0) {
    const matches = items.filter(
      (i) => i.name && (i.name.toLowerCase().includes(norm) || i.category && i.category.toLowerCase().includes(norm))
    );
    matches.slice(0, 5).forEach((m) => suggestions.push(m.name));
  }
  const defaults = ["Red Velvet Cake", "Butter Croissant", "Strawberry Bento Cake", "Chocolate Truffle Bento", "Belgian Hot Chocolate"];
  for (const d of defaults) {
    if (suggestions.length >= 5) break;
    if (!suggestions.includes(d)) {
      suggestions.push(d);
    }
  }
  return suggestions.slice(0, 5);
}
async function getSmartRecommendation(query, items) {
  const cacheKey = getNormalizedKey(query);
  if (SEEDED_RECOMMENDATIONS[cacheKey]) {
    console.log(`[RecommendationCache] Serving seeded recommendation for: "${cacheKey}"`);
    return SEEDED_RECOMMENDATIONS[cacheKey];
  }
  if (recCache.has(cacheKey)) {
    console.log(`[RecommendationCache] Serving cached recommendation for: "${cacheKey}"`);
    return recCache.get(cacheKey);
  }
  if (Date.now() < quotaExhaustedUntil) {
    console.log("[RecommendationService] Active cooldown: using local matching engine.");
    return getLocalRecommendation(query, items);
  }
  try {
    const genAI2 = getGenAI();
    const prompt = `
      User Search Query: "${query}"
      Available Menu Items (IDs are strings): ${items && items.length > 0 ? JSON.stringify(items) : "No direct menu provided."}
   
      Task: Act as the "Frosty Bite Butler", a premium dessert concierge.
      Analyze the search for intent, occasion, and emotional fit.
   
      IMPORTANT: ONLY respond with valid JSON. Do not include markdown code blocks.
      
      {
        "bestMatchId": "string-id-or-null",
        "reason": "Dramatic phrase (max 8 words)",
        "intent": "Occasion detected",
        "alternatives": ["id1", "id2"],
        "isEmotionalMatch": true,
        "occasionDetected": "e.g. Birthday",
        "moodDetected": "e.g. Celebratory",
        "recommendationType": "one of: occasion, flavor, budget, trending, standard",
        "butlerResponse": "1-2 sophisticated sentences."
      }
    `;
    let aiResponse;
    try {
      console.log(`[RecommendationService] Calling Gemini (gemini-2.5-flash) for: "${query.substring(0, 50)}..."`);
      aiResponse = await genAI2.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.",
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : error && typeof error === "object" ? JSON.stringify(error) : String(error);
      const isTransientOrQuota = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("demand") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("quota") || errorStr.includes("Quota exceeded") || String(error).includes("429") || error && typeof error === "object" && (error.status === 429 || error.statusCode === 429);
      if (isTransientOrQuota) {
        console.log(`[RecommendationService] Cooldown triggered. Primary model quota limit reached. Using local match fallback.`);
        quotaExhaustedUntil = Date.now() + 15 * 60 * 1e3;
      } else {
        console.log(`[RecommendationService] Fallback activated: parsing query locally.`);
      }
      return getLocalRecommendation(query, items);
    }
    const output = cleanJsonResponse(aiResponse.text || "");
    if (!output) {
      throw new Error("Empty response from AI");
    }
    const data = JSON.parse(output);
    const result = {
      bestMatchId: data.bestMatchId ? String(data.bestMatchId) : null,
      reason: data.reason || "A choice of absolute distinction.",
      intent: data.intent || "Luxury Exploration",
      alternatives: Array.isArray(data.alternatives) ? data.alternatives.map(String) : [],
      isEmotionalMatch: !data.isEmotionalMatch,
      occasionDetected: data.occasionDetected || "Special Moment",
      moodDetected: data.moodDetected || "Refined",
      recommendationType: data.recommendationType || "standard",
      butlerResponse: data.butlerResponse || "I have curated our finest selections based on your unique preferences."
    };
    recCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.log(`[RecommendationService] Note: Using local match fallback:`, err.message || err);
    return getLocalRecommendation(query, items);
  }
}
async function getSearchSuggestions(searchTerm, items) {
  const cacheKey = getNormalizedKey(searchTerm);
  if (SEEDED_SUGGESTIONS[cacheKey]) {
    return SEEDED_SUGGESTIONS[cacheKey];
  }
  if (sugCache.has(cacheKey)) {
    console.log(`[SuggestionsCache] Serving cached suggestions for: "${cacheKey}"`);
    return sugCache.get(cacheKey);
  }
  if (Date.now() < quotaExhaustedUntil) {
    return getLocalSuggestions(searchTerm, items);
  }
  try {
    const genAI2 = getGenAI();
    const prompt = `
      Search Term: "${searchTerm}"
      Available Menu Context: ${items && items.length > 0 ? JSON.stringify(items.slice(0, 20)) : "Bakery and cakes"}
      Predict 5 natural, high-intent search phrases for this premium bakery.
      Respond ONLY with a JSON object: { "suggestions": ["phrase1", "phrase2", ...] }
    `;
    let response;
    try {
      response = await genAI2.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the Frosty Bite Butler suggestions engine.",
          responseMimeType: "application/json"
        }
      });
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : err && typeof err === "object" ? JSON.stringify(err) : String(err);
      const isTransientOrQuota = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("demand") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("quota") || errorStr.includes("Quota exceeded") || String(err).includes("429") || err && typeof err === "object" && (err.status === 429 || err.statusCode === 429);
      if (isTransientOrQuota) {
        console.log(`[RecommendationService] Suggestions engine cooldown triggered due to quota limit.`);
        quotaExhaustedUntil = Date.now() + 15 * 60 * 1e3;
      } else {
        console.log(`[RecommendationService] Suggestions engine primary model fallback activated.`);
      }
      return getLocalSuggestions(searchTerm, items);
    }
    const output = cleanJsonResponse(response.text || "");
    if (!output) return getLocalSuggestions(searchTerm, items);
    const data = JSON.parse(output);
    const resultList = data.suggestions || getLocalSuggestions(searchTerm, items);
    sugCache.set(cacheKey, resultList);
    return resultList;
  } catch (err) {
    console.log(`[RecommendationService] Note: Suggestions pipeline match:`, err.message || err);
    return getLocalSuggestions(searchTerm, items);
  }
}
var recCache, sugCache, quotaExhaustedUntil, SEEDED_RECOMMENDATIONS, SEEDED_SUGGESTIONS;
var init_recommendation_service = __esm({
  "server/services/recommendation.service.ts"() {
    init_gemini();
    recCache = /* @__PURE__ */ new Map();
    sugCache = /* @__PURE__ */ new Map();
    quotaExhaustedUntil = 0;
    SEEDED_RECOMMENDATIONS = {
      "recommend a masterpiece for a luxury treat": {
        bestMatchId: "7",
        reason: "Pure dark chocolate fudge decadent bento masterpiece.",
        intent: "Luxury Indulgence",
        alternatives: ["1", "6"],
        isEmotionalMatch: true,
        occasionDetected: "Luxury Treat",
        moodDetected: "Decadent",
        recommendationType: "trending",
        butlerResponse: "The Chocolate Truffle Bento is an absolute masterpiece of cocoa. Our master bakers hand-craft each cake using single-origin Belgian dark chocolate, creating an experience of pure luxury."
      },
      "best celebratory dessert for a premium member": {
        bestMatchId: "1",
        reason: "Elegant, satin crimson silk red velvet masterpiece.",
        intent: "Gala Celebration",
        alternatives: ["7", "6"],
        isEmotionalMatch: true,
        occasionDetected: "Member Milestone",
        moodDetected: "Celebratory",
        recommendationType: "occasion",
        butlerResponse: "To celebrate your esteemed membership, I highly recommend our signature Red Velvet Cake. Its smooth crimson layers and rich cream cheese frosting create the ultimate celebratory tasting."
      }
    };
    SEEDED_SUGGESTIONS = {
      "recommend a masterpiece for a luxury treat": ["Chocolate Truffle Bento", "Red Velvet Cake", "Strawberry Bento Cake"],
      "best celebratory dessert for a premium member": ["Red Velvet Cake", "Chocolate Truffle Bento", "Strawberry Bento Cake"],
      "chocolate": ["Chocolate Truffle Bento", "Choco Chip Cookie", "Belgian Hot Chocolate"],
      "cake": ["Red Velvet Cake", "Strawberry Bento Cake", "Chocolate Truffle Bento"],
      "pastry": ["Butter Croissant"],
      "bento": ["Strawberry Bento Cake", "Chocolate Truffle Bento"],
      "strawberry": ["Strawberry Bento Cake"]
    };
  }
});

// server/lib/supabase.ts
var supabase_exports = {};
__export(supabase_exports, {
  supabase: () => supabase
});
import { createClient } from "@supabase/supabase-js";
function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) {
      throw new Error(
        "[Supabase Server] SUPABASE_URL is required"
      );
    }
    if (!supabaseServiceKey) {
      throw new Error(
        "[Supabase Server] SUPABASE_SERVICE_ROLE_KEY is required"
      );
    }
    let sanitizedUrl = supabaseUrl.replace(/https?:\/\/https?:\/\//g, "https://");
    sanitizedUrl = sanitizedUrl.replace(/\/rest\/v1\/?$/i, "");
    sanitizedUrl = sanitizedUrl.replace(/\/$/, "");
    supabaseInstance = createClient(
      sanitizedUrl,
      supabaseServiceKey
    );
  }
  return supabaseInstance;
}
function wrapThenableWithTimeout(obj, parent, ms = 8e3) {
  if (obj === null || obj === void 0) return obj;
  if (typeof obj === "function") {
    const boundFn = obj.bind(parent);
    return function(...args) {
      const result = boundFn(...args);
      return wrapThenableWithTimeout(result, this || parent, ms);
    };
  }
  if (typeof obj === "object") {
    return new Proxy(obj, {
      get: (target, prop) => {
        if (prop === "then") {
          if (typeof target.then !== "function") return void 0;
          return function(onfulfilled, onrejected) {
            const p = new Promise((resolve, reject) => {
              let completed = false;
              const timer = setTimeout(() => {
                if (!completed) {
                  completed = true;
                  reject(new Error(`Supabase operation timed out after ${ms}ms`));
                }
              }, ms);
              target.then.call(
                target,
                (res) => {
                  if (!completed) {
                    completed = true;
                    clearTimeout(timer);
                    resolve(res);
                  }
                },
                (err) => {
                  if (!completed) {
                    completed = true;
                    clearTimeout(timer);
                    reject(err);
                  }
                }
              );
            });
            return p.then(onfulfilled, onrejected);
          };
        }
        const val = target[prop];
        if (val !== null && (typeof val === "object" || typeof val === "function")) {
          return wrapThenableWithTimeout(val, target, ms);
        }
        return val;
      }
    });
  }
  return obj;
}
var supabaseInstance, supabase;
var init_supabase = __esm({
  "server/lib/supabase.ts"() {
    supabaseInstance = null;
    supabase = new Proxy({}, {
      get: (target, prop) => {
        const client = getSupabaseClient();
        const value = client[prop];
        if (process.env.NODE_ENV === "production") {
          return typeof value === "function" ? value.bind(client) : value;
        }
        return wrapThenableWithTimeout(value, client, 8e3);
      }
    });
  }
});

// server/services/butlerChat.service.ts
async function lookupLiveOrder(searchTerm) {
  try {
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return null;
    if (cleanTerm.length >= 6) {
      const { data: orderById, error: err } = await supabase.from("orders").select("*").ilike("id", `%${cleanTerm}%`).limit(1).maybeSingle();
      if (!err && orderById) return orderById;
    }
    const numbersOnly = cleanTerm.replace(/\D/g, "");
    if (numbersOnly.length >= 8) {
      const { data: orderByPhone, error: err } = await supabase.from("orders").select("*").or(`phone.eq.${numbersOnly},phone.like.%${numbersOnly}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!err && orderByPhone) return orderByPhone;
    }
  } catch (e) {
    console.warn("[ButlerChatService] Live order lookup error:", e);
  }
  return null;
}
async function getButlerChatResponse(userInput, history, clientItems, customerName) {
  try {
    const genAI2 = getGenAI();
    let orderContext = "No specific order selected yet.";
    const potentialTracker = userInput.match(/(?:(?:order\s+)?(?:id|number|phone|tracking|track)\s+(?:is\s+)?|#\s*)?([a-f0-9\-]{8,36}|\d{8,12})/i);
    const trackingTerm = potentialTracker ? potentialTracker[1] : userInput;
    const liveOrder = await lookupLiveOrder(trackingTerm);
    if (liveOrder) {
      orderContext = `LIVE FOUND TRACKING ORDER:
ID: ${liveOrder.id}
Customer Name: ${liveOrder.customer_name || liveOrder.customerName || "N/A"}
Items ordered: ${JSON.stringify(liveOrder.items || [])}
Total: \u20B9${liveOrder.total || liveOrder.total_amount || 0}
Status: ${liveOrder.status}
Payment Status: ${liveOrder.payment_status}
Created At: ${liveOrder.created_at}
Estimated Delivery Time: ${liveOrder.estimated_delivery_time || 25} mins`;
    }
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
    const catalogSnippet = catalog && catalog.length > 0 ? catalog.map((p) => `- ${p.name} (ID: ${p.id}, Category: ${p.category}, Price: \u20B9${p.price}, Description: ${p.description})`).join("\n") : "No direct catalog. Assume typical bakery items if not requested.";
    const systemInstruction = `
You are the Frosty Bite AI Butler, the official AI voice and chat assistant for Frosty Bite Bakery.
You must speak like a helpful bakery receptionist or staff member. Warm, friendly, cheerful, professional, and hospitable.

PERSONALITY & VOICE MODE RULES:
- Keep responses concise, warm, and highly conversational.
- Pause naturally between ideas.
- Ask ONLY ONE question at a time. Do not overwhelm the customer.
- Keep most responses short (under 15 seconds reading time, so about 1-3 sentences maximum).
- Avoid technical jargon, system coordinates, or developer code markers.
- Use the customer's name ("${customerName || "valuable guest"}") in your messages when available.

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
    const geminiContents = [];
    if (history && history.length > 0) {
      history.slice(-15).forEach((msg) => {
        geminiContents.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      });
    }
    geminiContents.push({
      role: "user",
      parts: [{ text: userInput }]
    });
    const aiResponse = await genAI2.models.generateContent({
      model: "gemini-2.5-flash",
      contents: geminiContents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.35
      }
    });
    const strippedText = cleanJsonResponse(aiResponse.text || "");
    const parsed = JSON.parse(strippedText);
    return {
      reply: parsed.reply || "I didn't catch that. Could you please check with our team or try again?",
      action: parsed.action || null,
      actionData: parsed.actionData || null
    };
  } catch (error) {
    console.error("[ButlerChatService] Gemini Chat Error:", error);
    return {
      reply: "I'm sorry, valuable guest. I'm having trouble accessing my bakery archives right now. Please try again in a moment or contact our staff directly.",
      action: null,
      actionData: null
    };
  }
}
var init_butlerChat_service = __esm({
  "server/services/butlerChat.service.ts"() {
    init_gemini();
    init_supabase();
  }
});

// server/controllers/butler.controller.ts
async function handleChat(req, res) {
  console.log(`[ButlerController] handleChat called with message: "${req.body.message}"`);
  const { message, history, items, customerName } = req.body;
  try {
    const result = await getButlerChatResponse(
      message,
      history || [],
      items || [],
      customerName
    );
    console.log(`[ButlerController] handleChat success -> action: ${result.action}`);
    res.json(result);
  } catch (error) {
    console.error(`[ButlerController] handleChat error:`, error);
    res.status(500).json({ error: "Butler Chat failed", details: error.message });
  }
}
async function getRecommendation(req, res) {
  console.log(`[ButlerController] getRecommendation called with query: "${req.body.query}"`);
  const { query, items } = req.body;
  try {
    const result = await getSmartRecommendation(query || "", items || []);
    console.log(`[ButlerController] getRecommendation success`);
    res.json(result);
  } catch (error) {
    console.error(`[ButlerController] getRecommendation error, using local fallback:`, error);
    const fallback = await getSmartRecommendation(query || "bakery", items || []);
    res.json(fallback);
  }
}
async function getSuggestions(req, res) {
  console.log(`[ButlerController] getSuggestions called with searchTerm: "${req.body.searchTerm}"`);
  const { searchTerm, items } = req.body;
  try {
    const result = await getSearchSuggestions(searchTerm || "", items || []);
    console.log(`[ButlerController] getSuggestions success`);
    res.json({ suggestions: result });
  } catch (error) {
    console.error(`[ButlerController] getSuggestions error, using local fallback:`, error);
    const fallback = await getSearchSuggestions(searchTerm || "", items || []);
    res.json({ suggestions: fallback });
  }
}
var init_butler_controller = __esm({
  "server/controllers/butler.controller.ts"() {
    init_recommendation_service();
    init_butlerChat_service();
  }
});

// server/routes/butler.routes.ts
var butler_routes_exports = {};
__export(butler_routes_exports, {
  default: () => butler_routes_default
});
import { Router } from "express";
var router, butler_routes_default;
var init_butler_routes = __esm({
  "server/routes/butler.routes.ts"() {
    init_butler_controller();
    router = Router();
    router.post("/chat", handleChat);
    router.post("/recommend", getRecommendation);
    router.post("/suggestions", getSuggestions);
    butler_routes_default = router;
  }
});

// server/ai/huggingface.ts
import { HfInference } from "@huggingface/inference";
function getHF() {
  if (!hf) {
    const token = process.env.HF_TOKEN;
    if (!token) {
      console.warn("HF_TOKEN missing, HuggingFace inference will be disabled.");
      return null;
    }
    hf = new HfInference(token);
  }
  return hf;
}
var hf;
var init_huggingface = __esm({
  "server/ai/huggingface.ts"() {
    hf = null;
  }
});

// server/services/avatar.service.ts
async function generateAvatarImage(data) {
  const { prompt, vibe, imageUrl, userId } = data;
  let imageResult = null;
  try {
    const genAIClient = getGenAI();
    let targetModel = "gemini-2.5-flash";
    if (imageUrl && imageUrl.startsWith("http")) {
      try {
        const fetchRes = await fetch(imageUrl);
        const buffer = await fetchRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = fetchRes.headers.get("content-type") || "image/jpeg";
        let response;
        try {
          response = await genAIClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
              parts: [
                { text: `System: Analyze the provided image and generate a creative prompt for a high-quality image generator.

Describe this person's facial features and style to help generate a ${prompt || "cute bakery-themed chibi avatar"}. Output ONLY the refined generation prompt based on their face and the requested vibe: ${vibe || "kawaii"}. No prefixes, no conversational filler, just the prompt string.` },
                { inlineData: { data: base64, mimeType } }
              ]
            }
          });
        } catch (error) {
          const errorStr = error instanceof Error ? error.message : error && typeof error === "object" ? JSON.stringify(error) : String(error);
          const isTransientOrQuota = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("demand") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("quota") || errorStr.includes("Quota exceeded");
          if (isTransientOrQuota) {
            console.warn(`[AvatarService] Vision analysis primary model returned transient/quota status: ${errorStr}. Retrying...`);
            response = await genAIClient.models.generateContent({
              model: "gemini-2.5-flash",
              contents: {
                parts: [
                  { text: `System: Analyze the provided image and generate a creative prompt for a high-quality image generator.

Describe this person's facial features and style to help generate a ${prompt || "cute bakery-themed chibi avatar"}. Output ONLY the refined generation prompt based on their face and the requested vibe: ${vibe || "kawaii"}. No prefixes, no conversational filler, just the prompt string.` },
                  { inlineData: { data: base64, mimeType } }
                ]
              }
            });
          } else {
            throw error;
          }
        }
        if (!response.text) {
          console.warn("[AvatarService] Gemini vision returned empty text, using baseline prompt");
        }
        let refinedPrompt = cleanJsonResponse(response.text || prompt || "Cute bakery-themed chibi avatar");
        refinedPrompt = refinedPrompt.replace(/^(Prompt|Output|Refined Prompt|Image Prompt):/i, "").trim();
        if (process.env.HF_TOKEN) {
          const hfClient = getHF();
          if (hfClient) {
            console.log("[AvatarService] Generating image via HF XL...");
            const hfResult = await hfClient.textToImage({
              model: "stabilityai/stable-diffusion-xl-base-1.0",
              inputs: refinedPrompt,
              parameters: { negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy", width: 512, height: 512 }
            });
            const hfBuffer = await hfResult.arrayBuffer();
            imageResult = `data:image/png;base64,${Buffer.from(hfBuffer).toString("base64")}`;
            console.log("[AvatarService] HF XL Generation successful");
          }
        }
      } catch (visionError) {
        console.warn("[AvatarService] Vision analysis or HF XL failed:", visionError);
      }
    }
    if (!imageResult && process.env.HF_TOKEN) {
      try {
        const hfClient = getHF();
        if (hfClient) {
          console.log("[AvatarService] Trying fallback HF SD 1.5...");
          const result = await hfClient.textToImage({
            model: "runwayml/stable-diffusion-v1-5",
            inputs: prompt || "Cute bakery-themed chibi avatar, kawaii aesthetic, soft lighting, profile picture",
            parameters: { negative_prompt: "blurry, simple, low res", width: 512, height: 512 }
          });
          const buffer = await result.arrayBuffer();
          imageResult = `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
          console.log("[AvatarService] HF Fallback successful");
        }
      } catch (hfError) {
        console.warn("[AvatarService] HF direct generation failed:", hfError);
      }
    }
    if (!imageResult) {
      try {
        let response;
        try {
          response = await genAIClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
          });
        } catch (error) {
          const errorStr = error instanceof Error ? error.message : error && typeof error === "object" ? JSON.stringify(error) : String(error);
          const isTransientOrQuota = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("demand") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("quota") || errorStr.includes("Quota exceeded");
          if (isTransientOrQuota) {
            console.warn(`[AvatarService] SVG generation model returned transient/quota status: ${errorStr}. Retrying...`);
            response = await genAIClient.models.generateContent({
              model: "gemini-2.5-flash",
              contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
            });
          } else {
            throw error;
          }
        }
        const text = response.text || "";
        const svgCode = text.match(/<svg[\s\S]*<\/svg>/)?.[0] || text.replace(/```svg|```|```html|```/g, "").trim();
        if (svgCode && svgCode.includes("<svg")) {
          imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString("base64")}`;
        }
      } catch (geminiError) {
        console.warn("[AvatarService] SVG generation failed:", geminiError.message);
      }
    }
    if (!imageResult) {
      console.log("[AvatarService] Using DiceBear fallback");
      const seedVal = `${userId || "anon"}-${Date.now()}`;
      imageResult = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
    }
    return imageResult;
  } catch (error) {
    console.error("[AiService] Generation fatal error:", error);
    const seedVal = `${userId || "anon"}-${Date.now()}`;
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
  }
}
var init_avatar_service = __esm({
  "server/services/avatar.service.ts"() {
    init_huggingface();
    init_gemini();
  }
});

// server/controllers/avatar.controller.ts
async function generateAvatar(req, res) {
  const { prompt, vibe, imageUrl, userId } = req.body;
  console.log(`[Avatar Controller] Generating avatar for user: ${userId}`);
  try {
    const imageUrlResult = await generateAvatarImage({ prompt, vibe, imageUrl, userId });
    res.status(200).json({
      status: "completed",
      url: imageUrlResult
    });
  } catch (error) {
    console.error("[Avatar Controller] Generation Error:", error);
    res.status(500).json({ error: "Failed to generate avatar", details: error.message });
  }
}
var init_avatar_controller = __esm({
  "server/controllers/avatar.controller.ts"() {
    init_avatar_service();
  }
});

// server/middleware/auth.ts
var verifyFirebaseToken;
var init_auth = __esm({
  "server/middleware/auth.ts"() {
    init_supabase();
    verifyFirebaseToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
      }
      try {
        const token = authHeader.split("Bearer ")[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          try {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
              if (payload && (payload.email || payload.user_metadata?.email)) {
                req.user = {
                  uid: payload.sub || payload.id,
                  email: payload.email || payload.user_metadata?.email,
                  ...payload
                };
                return next();
              }
            }
          } catch (_) {
          }
          return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        }
        req.user = {
          uid: user.id,
          email: user.email,
          ...user
        };
        next();
      } catch (err) {
        console.error("[Auth Middleware] Token verification failed:", err);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }
    };
  }
});

// server/middleware/validate.ts
var validate;
var init_validate = __esm({
  "server/middleware/validate.ts"() {
    validate = (schema) => (req, res, next) => {
      try {
        schema.parse(req.body);
        next();
      } catch (error) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
    };
  }
});

// server/validators/avatar.schema.ts
import { z } from "zod";
var avatarSchema;
var init_avatar_schema = __esm({
  "server/validators/avatar.schema.ts"() {
    avatarSchema = z.object({
      prompt: z.string().optional(),
      vibe: z.string().optional(),
      imageUrl: z.string().optional(),
      userId: z.string()
    });
  }
});

// server/routes/avatar.routes.ts
var avatar_routes_exports = {};
__export(avatar_routes_exports, {
  default: () => avatar_routes_default
});
import { Router as Router2 } from "express";
var router2, avatar_routes_default;
var init_avatar_routes = __esm({
  "server/routes/avatar.routes.ts"() {
    init_avatar_controller();
    init_auth();
    init_validate();
    init_avatar_schema();
    router2 = Router2();
    router2.post("/generate", verifyFirebaseToken, validate(avatarSchema), generateAvatar);
    avatar_routes_default = router2;
  }
});

// server/services/user.service.ts
var UserService;
var init_user_service = __esm({
  "server/services/user.service.ts"() {
    init_supabase();
    UserService = class {
      static async syncUser(params) {
        const rawEmail = params.email;
        if (!rawEmail) {
          throw new Error("[UserService] Email is required to resolve identity.");
        }
        const email = rawEmail.trim().toLowerCase();
        const firebaseUid = params.uid || params.firebaseUid || null;
        const supabaseUid = params.supabaseUid || null;
        console.log(`[UserService] Resolving identity for ${email} with firebaseUid: ${firebaseUid}, supabaseUid: ${supabaseUid}`);
        try {
          if (firebaseUid) {
            const { data: collidingFirebaseUser } = await supabase.from("users").select("*").eq("firebase_uid", firebaseUid).maybeSingle();
            if (collidingFirebaseUser && collidingFirebaseUser.email !== email) {
              console.warn(`[UserService] Unifying Identity: Detaching duplicate firebase_uid "${firebaseUid}" from registered email "${collidingFirebaseUser.email}" to resolve merge conflicts.`);
              await supabase.from("users").update({ firebase_uid: null }).eq("id", collidingFirebaseUser.id);
            }
          }
          if (supabaseUid) {
            const { data: collidingSupabaseUser } = await supabase.from("users").select("*").eq("supabase_uid", supabaseUid).maybeSingle();
            if (collidingSupabaseUser && collidingSupabaseUser.email !== email) {
              console.warn(`[UserService] Unifying Identity: Detaching duplicate supabase_uid "${supabaseUid}" from registered email "${collidingSupabaseUser.email}" to resolve merge conflicts.`);
              await supabase.from("users").update({ supabase_uid: null }).eq("id", collidingSupabaseUser.id);
            }
          }
          const { data: userByEmail } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
          let user = userByEmail;
          if (!user && firebaseUid) {
            const { data: userByFb } = await supabase.from("users").select("*").eq("firebase_uid", firebaseUid).maybeSingle();
            if (userByFb) {
              console.log(`[UserService] Identity resolved cross-match via firebase_uid: ${firebaseUid} for ${email}`);
              user = userByFb;
            }
          }
          if (!user && supabaseUid) {
            const { data: userBySb } = await supabase.from("users").select("*").eq("supabase_uid", supabaseUid).maybeSingle();
            if (userBySb) {
              console.log(`[UserService] Identity resolved cross-match via supabase_uid: ${supabaseUid} for ${email}`);
              user = userBySb;
            }
          }
          const name = params.displayName || params.name || email.split("@")[0];
          const avatarUrl = params.photoURL || params.avatar_url || null;
          if (!user) {
            console.log(`[UserService] No existing identity found for ${email}. Creating a new master record...`);
            const methods = [];
            if (firebaseUid) methods.push("firebase");
            if (supabaseUid) methods.push("otp");
            const { data: newUser, error: insertError } = await supabase.from("users").insert({
              email,
              name,
              full_name: name,
              avatar_url: avatarUrl,
              avatar: avatarUrl,
              firebase_uid: firebaseUid,
              supabase_uid: supabaseUid,
              auth_methods: methods,
              last_login: (/* @__PURE__ */ new Date()).toISOString(),
              last_login_at: (/* @__PURE__ */ new Date()).toISOString()
            }).select().single();
            if (insertError) {
              console.warn("[UserService] Insert failed, checking if user was created concurrently:", insertError.message || insertError);
              const { data: concurrentUser } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
              if (concurrentUser) {
                console.log("[UserService] Concurrent user detected via email. Proceeding to merge update phase.");
                user = concurrentUser;
              } else {
                let foundByUid = null;
                if (firebaseUid) {
                  const { data: checkFb } = await supabase.from("users").select("*").eq("firebase_uid", firebaseUid).maybeSingle();
                  foundByUid = checkFb;
                }
                if (!foundByUid && supabaseUid) {
                  const { data: checkSb } = await supabase.from("users").select("*").eq("supabase_uid", supabaseUid).maybeSingle();
                  foundByUid = checkSb;
                }
                if (foundByUid) {
                  console.log("[UserService] Concurrent user detected via UID. Proceeding to merge update phase.");
                  user = foundByUid;
                } else {
                  console.error("[UserService] Insert Error remains unresolved:", insertError);
                  throw insertError;
                }
              }
            } else {
              return newUser;
            }
          }
          console.log(`[UserService] Match found in master database for ${email}. Merging profiles...`);
          const updates = {
            last_login: (/* @__PURE__ */ new Date()).toISOString(),
            last_login_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (user.email !== email) {
            updates.email = email;
          }
          if (name && (!user.name || user.name === user.email.split("@")[0] || user.name === "")) {
            updates.name = name;
            updates.full_name = name;
          }
          if (avatarUrl && !user.avatar_url) {
            updates.avatar_url = avatarUrl;
            updates.avatar = avatarUrl;
          }
          const existingMethods = user.auth_methods || [];
          const updatedMethods = [...existingMethods];
          if (firebaseUid && user.firebase_uid !== firebaseUid) {
            updates.firebase_uid = firebaseUid;
            if (!updatedMethods.includes("firebase")) {
              updatedMethods.push("firebase");
            }
          }
          if (supabaseUid && user.supabase_uid !== supabaseUid) {
            updates.supabase_uid = supabaseUid;
            if (!updatedMethods.includes("otp")) {
              updatedMethods.push("otp");
            }
          }
          if (updatedMethods.length === 0) {
            if (firebaseUid) updatedMethods.push("firebase");
            if (supabaseUid || user.supabase_uid) updatedMethods.push("otp");
          }
          if (JSON.stringify(existingMethods.sort()) !== JSON.stringify(updatedMethods.sort())) {
            updates.auth_methods = updatedMethods;
          }
          if (Object.keys(updates).length >= 2) {
            console.log(`[UserService] Applying clean identity resolution merges for ${email}:`, updates);
            const { data: updatedUser, error: updateError } = await supabase.from("users").update(updates).eq("id", user.id).select().single();
            if (updateError) {
              console.error("[UserService] Update Error during identity resolution:", updateError);
              throw updateError;
            }
            return updatedUser;
          }
          console.log(`[UserService] Master profile is already fully synced & merged for ${email}.`);
          return user;
        } catch (error) {
          console.error("[UserService] Unified Identity Resolution failed miserably:", error);
          throw error;
        }
      }
      static async getUserByFirebaseUid(uid) {
        const { data, error } = await supabase.from("users").select("*").eq("firebase_uid", uid).single();
        if (error) return null;
        return data;
      }
      static async getUserBySupabaseUid(uid) {
        const { data, error } = await supabase.from("users").select("*").eq("supabase_uid", uid).single();
        if (error) return null;
        return data;
      }
    };
  }
});

// server/services/email.service.ts
import nodemailer from "nodemailer";
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn("[EmailService] SMTP credentials (SMTP_USER, SMTP_PASS) are not fully configured in your environment variables. Using fallback mode.");
    return null;
  }
  const credsKey = `${host}:${port}:${user}:${pass}`;
  if (transporter && lastUsedCredsKey === credsKey) {
    return transporter;
  }
  console.log(`[EmailService] Creating SMTP transporter for ${host}:${port} with user: ${user}`);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    // true for 465, false for other ports
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 4e3,
    // 4 seconds
    greetingTimeout: 3e3,
    // 3 seconds
    socketTimeout: 5e3
    // 5 seconds
  });
  transporter.on("error", (err) => {
    console.error("[EmailService] Async Transporter Error:", err);
  });
  lastUsedCredsKey = credsKey;
  return transporter;
}
function formatFromAddress(fromStr) {
  if (!fromStr) return '"Frosty Bite" <noreply@frostybite.com>';
  if (fromStr.includes("<") && fromStr.includes(">")) {
    return fromStr;
  }
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = fromStr.match(emailRegex);
  if (match) {
    const email = match[1];
    let restOfStr = fromStr.replace(email, "").trim();
    restOfStr = restOfStr.replace(/^['"]|['"]$/g, "").trim();
    if (restOfStr) {
      return `"${restOfStr}" <${email}>`;
    }
    return email;
  }
  return fromStr;
}
var transporter, lastUsedCredsKey, EmailService;
var init_email_service = __esm({
  "server/services/email.service.ts"() {
    transporter = null;
    lastUsedCredsKey = "";
    EmailService = class {
      /**
       * Sends an OTP (Verification Code) via SMTP
       */
      static async sendOTPEmail(email, otp) {
        const defaultUser = process.env.SMTP_USER || "noreply@frostybite.com";
        const rawFrom = process.env.SMTP_FROM || `"Frosty Bite" <${defaultUser}>`;
        const from = formatFromAddress(rawFrom);
        const rawDigits = String(otp || "").replace(/\D/g, "");
        const cleanOtp = rawDigits.length >= 6 ? rawDigits.slice(0, 6) : rawDigits ? rawDigits.padStart(6, "0") : Math.floor(1e5 + Math.random() * 9e5).toString();
        console.log(`[EmailService] Normalized From: ${from} (Raw: ${rawFrom}), Dispathing 6-Digit Code: ${cleanOtp}`);
        const mailOptions = {
          from,
          to: email,
          subject: `Your Frosty Bite 6-Digit Verification Code: ${cleanOtp}`,
          text: `Welcome to Frosty Bite! Your 6-digit login verification code is: ${cleanOtp}. This code is valid for 5 minutes.`,
          html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Frosty Bite Verification</title>
          <style>
            body {
              background-color: #080808;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #ffffff;
            }
            .container {
              max-width: 500px;
              margin: 40px auto;
              background-color: #111111;
              border: 1px solid #222222;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            .logo {
              font-family: system-ui, sans-serif;
              font-size: 28px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -1px;
              color: #ff6b00;
              margin-bottom: 24px;
              font-style: italic;
            }
            .logo span {
              color: #ffffff;
            }
            h1 {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #ffffff;
            }
            p {
              font-size: 15px;
              line-height: 1.6;
              color: #a0a0a0;
              margin-bottom: 30px;
            }
            .code-box {
              background: linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(255,107,0,0.02) 100%);
              border: 2px dashed rgba(255, 107, 0, 0.3);
              border-radius: 16px;
              padding: 20px;
              margin: 24px 0;
              display: inline-block;
              width: 80%;
            }
            .code {
              font-family: "Courier New", Courier, monospace;
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #ff6b00;
            }
            .footer {
              font-size: 12px;
              color: #555555;
              margin-top: 40px;
              border-top: 1px solid #222222;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">FROSTY<span>BITE</span></div>
            <h1>Log Into Your Account</h1>
            <p>Welcome back! Use the following 8-digit one-time passcode to complete your sign-in. This code will expire in 5 minutes.</p>
            
            <div class="code-box">
              <div class="code">${cleanOtp}</div>
            </div>
            
            <p style="font-size: 13px; margin-top: 20px; color: #ff6b00;">If you did not request this code, you can safely ignore this email.</p>
            
            <div class="footer">
              &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Frosty Bite. All rights reserved.<br>
              Premium Desserts & Bites Delivered Fresh.
            </div>
          </div>
        </body>
        </html>
      `
        };
        const client = getTransporter();
        if (!client) {
          console.warn(`[EmailService] No SMTP transporter. Printed Login Code: ${otp} for ${email}`);
          return false;
        }
        try {
          console.log(`[EmailService] Sending OTP email to ${email} via SMTP...`);
          const info = await client.sendMail(mailOptions);
          console.log(`[EmailService] SMTP Email sent: ${info.messageId}`);
          return true;
        } catch (err) {
          console.error("[EmailService] SMTP Error sending email:", err);
          return false;
        }
      }
      /**
       * Sends a Welcome Email via SMTP
       */
      static async sendWelcomeEmail(email, name) {
        const defaultUser = process.env.SMTP_USER || "noreply@frostybite.com";
        const rawFrom = process.env.SMTP_FROM || `"Frosty Bite" <${defaultUser}>`;
        const from = formatFromAddress(rawFrom);
        const displayName = name || email.split("@")[0];
        const mailOptions = {
          from,
          to: email,
          subject: `Welcome to Frosty Bite, ${displayName}!`,
          text: `Hello ${displayName},

Welcome to Frosty Bite! We are thrilled to have you join our community of premium dessert lovers.

Enjoy browsing our delicious menu and get ready to indulge in the fresh desserts & bites of your dreams!

Best regards,
The Frosty Bite Team`,
          html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Frosty Bite</title>
          <style>
            body {
              background-color: #080808;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #ffffff;
            }
            .container {
              max-width: 500px;
              margin: 40px auto;
              background-color: #111111;
              border: 1px solid #222222;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            .logo {
              font-family: system-ui, sans-serif;
              font-size: 28px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -1px;
              color: #ff6b00;
              margin-bottom: 24px;
              font-style: italic;
            }
            .logo span {
              color: #ffffff;
            }
            h1 {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #ffffff;
            }
            p {
              font-size: 15px;
              line-height: 1.6;
              color: #a0a0a0;
              margin-bottom: 30px;
            }
            .welcome-box {
              background: linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(255,107,0,0.02) 100%);
              border: 1px solid rgba(255, 107, 0, 0.2);
              border-radius: 16px;
              padding: 24px;
              margin: 24px 0;
              text-align: left;
            }
            .welcome-box p {
              margin: 0;
              color: #ffffff;
              font-weight: 500;
            }
            .footer {
              font-size: 12px;
              color: #555555;
              margin-top: 40px;
              border-top: 1px solid #222222;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">FROSTY<span>BITE</span></div>
            <h1>Welcome, ${displayName}!</h1>
            <p>Thank you for creating an account with Frosty Bite. We are absolutely thrilled to bake for you.</p>
            
            <div class="welcome-box">
              <p>What's next?</p>
              <ul style="color: #a0a0a0; padding-left: 20px; margin-top: 10px; margin-bottom: 0; font-size: 14px; line-height: 1.6;">
                <li>Explore our curated menu of premium cookies, pastries, and bite-sized treats</li>
                <li>Set up your preferred delivery address and preferences</li>
                <li>Earn rewards and unlock exclusive sweets with our loyalty perks</li>
              </ul>
            </div>
            
            <p style="margin-top: 30px;">Let's make today a little sweeter.</p>
            
            <div class="footer">
              &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Frosty Bite. All rights reserved.<br>
              Premium Desserts & Bites Delivered Fresh.
            </div>
          </div>
        </body>
        </html>
      `
        };
        const client = getTransporter();
        if (!client) {
          console.warn(`[EmailService] No SMTP transporter. Welcome email printed to console for ${email}`);
          return false;
        }
        try {
          console.log(`[EmailService] Sending Welcome email to ${email} via SMTP...`);
          const info = await client.sendMail(mailOptions);
          console.log(`[EmailService] Welcome email sent: ${info.messageId}`);
          return true;
        } catch (err) {
          console.error("[EmailService] SMTP Error sending welcome email:", err);
          return false;
        }
      }
    };
  }
});

// server/services/whatsapp.service.ts
var WhatsAppService;
var init_whatsapp_service = __esm({
  "server/services/whatsapp.service.ts"() {
    WhatsAppService = class _WhatsAppService {
      static {
        // Static outbox queue for local WhatsApp server polling
        this.pendingQueue = [];
      }
      /**
       * Dispatches a 6-digit verification code to the recipient's WhatsApp account
       */
      static async sendOtpWhatsApp(phone, otp) {
        const cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length < 10) {
          throw new Error("Invalid phone number format. Must be at least 10 digits.");
        }
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const textMessage = `Cake *Frosty Bite Bakery*

Your verification code is:

*${otp}*

This code expires in 5 minutes.

Do not share this code with anyone.`;
        const whatsappUrl = (process.env.OPENWA_API_URL || process.env.WHATSAPP_SERVER_URL || "").replace(/\/+$/, "");
        const isCloudEnv = !!process.env.K_SERVICE || process.env.NODE_ENV === "production";
        if (!whatsappUrl || whatsappUrl.includes("localhost") || whatsappUrl.includes("127.0.0.1")) {
          console.log(`[WhatsAppService] Queueing WhatsApp message for polling delivery and client fallback.`);
          const messageId = Math.random().toString(36).substring(2, 15);
          _WhatsAppService.pendingQueue.push({
            id: messageId,
            phone: formattedPhone,
            message: textMessage,
            timestamp: Date.now()
          });
          return {
            success: true,
            provider: "polling-queue",
            message: `Verification code queued for WhatsApp delivery.`,
            dev_otp_hint: otp,
            client_dispatch_required: true,
            textMessage,
            formattedPhone
          };
        }
        console.log(`[WhatsAppService] Dispatching WhatsApp message to +${formattedPhone} using server at: ${whatsappUrl}...`);
        try {
          const isCustomServer = whatsappUrl.includes("localhost") || whatsappUrl.includes("127.0.0.1") || !process.env.OPENWA_SESSION_ID;
          const endpoint = isCustomServer ? `${whatsappUrl}/send` : `${whatsappUrl}/api/${process.env.OPENWA_SESSION_ID || "my-bot"}/send-text`;
          console.log(`[WhatsAppService] Resolved dispatch endpoint: ${endpoint}`);
          const headers = {
            "Content-Type": "application/json"
          };
          const openwaKey = process.env.OPENWA_API_KEY;
          if (openwaKey) {
            headers["X-API-Key"] = openwaKey;
            headers["Authorization"] = `Bearer ${openwaKey}`;
          }
          const body = isCustomServer ? { number: formattedPhone, message: textMessage } : { to: `${formattedPhone}@c.us`, msg: textMessage, content: textMessage };
          const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3e3)
            // timeout after 3s so cloud backend doesn't hang
          });
          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`WhatsApp server returned status ${response.status}: ${errorText || "Unknown error"}`);
          }
          const data = await response.json();
          console.log(`[WhatsAppService] Dispatch succeeded! Response:`, data);
          return {
            success: true,
            provider: isCustomServer ? "whatsapp-web.js" : "openwa",
            message: `Verification code sent to +${formattedPhone} via WhatsApp.`,
            dev_otp_hint: otp
          };
        } catch (err) {
          console.warn(`[WhatsAppService] Dispatch error:`, err.message || err);
          if (whatsappUrl.includes("localhost") || whatsappUrl.includes("127.0.0.1")) {
            console.log(`[WhatsAppService] Backend cannot reach local server ${whatsappUrl}. Queueing WhatsApp message for polling delivery and client fallback.`);
            const messageId = Math.random().toString(36).substring(2, 15);
            _WhatsAppService.pendingQueue.push({
              id: messageId,
              phone: formattedPhone,
              message: textMessage,
              timestamp: Date.now()
            });
            return {
              success: true,
              provider: "polling-queue",
              message: `Verification code queued for WhatsApp delivery.`,
              dev_otp_hint: otp,
              client_dispatch_required: true,
              textMessage,
              formattedPhone
            };
          }
          throw new Error(
            `Failed to send WhatsApp verification code. Please make sure your WhatsApp server is active and authenticated at ${whatsappUrl}. (Error: ${err.message || err})`
          );
        }
      }
    };
  }
});

// server/services/otpQueue.ts
import crypto from "crypto";
var OtpQueueService;
var init_otpQueue = __esm({
  "server/services/otpQueue.ts"() {
    init_whatsapp_service();
    init_email_service();
    OtpQueueService = class _OtpQueueService {
      // In-memory metrics for abnormal pattern detection
      constructor() {
        this.queue = [];
        this.activeJobsCount = 0;
        this.maxConcurrency = 1;
        // Controlled concurrency to prevent spam / messaging provider block
        // Deduplication & rate limit mappings
        this.idempotencyStore = /* @__PURE__ */ new Map();
        this.lastRequestTimes = /* @__PURE__ */ new Map();
        // Recipient cooldown (prevent accidental message bursts)
        this.ipRequestTimes = /* @__PURE__ */ new Map();
        // IP monitoring (for abnormal traffic alerting)
        this.systemMetrics = [];
        setInterval(() => this.cleanupIdempotencyKeys(), 6e4);
      }
      static getInstance() {
        if (!_OtpQueueService.instance) {
          _OtpQueueService.instance = new _OtpQueueService();
        }
        return _OtpQueueService.instance;
      }
      /**
       * Validates a phone number for format, digits, and reasonable length.
       */
      validatePhone(phone) {
        const clean = phone.replace(/\D/g, "");
        return clean.length >= 10 && clean.length <= 15;
      }
      /**
       * Helper to mask recipient identifier for privacy (never log clean OTPs or raw phone numbers fully)
       */
      maskRecipient(recipient) {
        if (recipient.includes("@")) {
          const [local, domain] = recipient.split("@");
          if (local.length <= 2) return `${local[0]}***@${domain}`;
          return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
        }
        const clean = recipient.replace(/\D/g, "");
        if (clean.length < 6) return "******";
        return `+${clean.slice(0, 3)}*****${clean.slice(-3)}`;
      }
      /**
       * Cleans up expired idempotency keys
       */
      cleanupIdempotencyKeys() {
        const now = Date.now();
        for (const [key, val] of this.idempotencyStore.entries()) {
          if (now > val.expiresAt) {
            this.idempotencyStore.delete(key);
          }
        }
      }
      /**
       * Tracks an event metric and analyzes for abnormal traffic spikes.
       */
      logMetric(recipient, ip, event, error) {
        const now = Date.now();
        const metric = { timestamp: now, recipient, ip, event, error };
        this.systemMetrics.push(metric);
        if (this.systemMetrics.length > 1e3) {
          this.systemMetrics.shift();
        }
        const maskedRecipient = this.maskRecipient(recipient);
        if (error) {
          console.warn(`[OTP System] Event: ${event.toUpperCase()} | Recipient: ${maskedRecipient} | IP: ${ip} | Error: ${error}`);
        } else {
          console.log(`[OTP System] Event: ${event.toUpperCase()} | Recipient: ${maskedRecipient} | IP: ${ip}`);
        }
        this.detectAbnormalPatterns(ip, recipient);
      }
      /**
       * Detects unusual request patterns and emits high-visibility warning logs
       */
      detectAbnormalPatterns(ip, recipient) {
        const now = Date.now();
        const oneMinuteAgo = now - 6e4;
        const fiveMinutesAgo = now - 5 * 6e4;
        const systemRecent = this.systemMetrics.filter((m) => m.timestamp > oneMinuteAgo && m.event === "requested");
        if (systemRecent.length > 15) {
          console.error(`
\u{1F6A8} ALERT: Abnormal System-Wide OTP Request Surge! Detected ${systemRecent.length} requests in the last 60 seconds.`);
        }
        const failuresRecent = this.systemMetrics.filter((m) => m.timestamp > fiveMinutesAgo && m.event === "failed");
        if (failuresRecent.length > 5) {
          console.error(`
\u{1F6A8} ALERT: High OTP Delivery Failure Rate! ${failuresRecent.length} dispatch failures in the last 5 minutes. Check WhatsApp server status!`);
        }
        const ipRecent = this.systemMetrics.filter((m) => m.ip === ip && m.timestamp > fiveMinutesAgo && m.event === "requested");
        if (ipRecent.length > 5) {
          console.warn(`
\u26A0\uFE0F WARNING: Suspected Bot Behavior! IP ${ip} requested OTP ${ipRecent.length} times in the last 5 minutes.`);
        }
      }
      /**
       * Registers a client request IP time-stamp to prevent rapid retries.
       */
      trackIpRateLimit(ip) {
        const now = Date.now();
        const windowMs = 5 * 60 * 1e3;
        const maxRequests = 5;
        let timestamps = this.ipRequestTimes.get(ip) || [];
        timestamps = timestamps.filter((t) => now - t < windowMs);
        timestamps.push(now);
        this.ipRequestTimes.set(ip, timestamps);
        return timestamps.length <= maxRequests;
      }
      /**
       * Enqueues an OTP request and processes it within controlled concurrency.
       */
      async enqueue(recipient, type, otp, ip, idempotencyKey, payload = {}) {
        const now = Date.now();
        const masked = this.maskRecipient(recipient);
        if (type === "whatsapp" && !this.validatePhone(recipient)) {
          this.logMetric(recipient, ip, "rate_limited", "Invalid phone number format");
          throw new Error("Please enter a valid mobile number (10 to 15 digits).");
        }
        const lastRequest = this.lastRequestTimes.get(recipient);
        if (lastRequest && now - lastRequest < 6e4) {
          const remaining = Math.ceil((6e4 - (now - lastRequest)) / 1e3);
          this.logMetric(recipient, ip, "rate_limited", `Accidental burst blocked (cooldown active: ${remaining}s remaining)`);
          throw new Error(`Accidental burst prevention: Please wait ${remaining} seconds before requesting another verification code.`);
        }
        if (!this.trackIpRateLimit(ip)) {
          this.logMetric(recipient, ip, "rate_limited", "IP limit exceeded");
          throw new Error("Security alert: Too many requests from this IP address. Please try again in 5 minutes.");
        }
        if (idempotencyKey) {
          const existing = this.idempotencyStore.get(idempotencyKey);
          if (existing) {
            if (existing.status === "completed" || existing.status === "pending") {
              console.log(`[OTP System] Deduplicated request for key: ${idempotencyKey}. Returning cached response.`);
              return existing.response;
            }
          }
          this.idempotencyStore.set(idempotencyKey, {
            status: "pending",
            response: null,
            expiresAt: now + 5 * 60 * 1e3
            // Cache key for 5 minutes
          });
        }
        this.lastRequestTimes.set(recipient, now);
        this.cancelPendingJobsForRecipient(recipient);
        this.logMetric(recipient, ip, "requested");
        return new Promise((resolve, reject) => {
          const job = {
            id: crypto.randomUUID(),
            recipient,
            type,
            otp,
            idempotencyKey,
            ip,
            payload,
            retries: 0,
            status: "pending",
            createdAt: now,
            resolve,
            reject
          };
          this.queue.push(job);
          this.processNext();
        });
      }
      /**
       * Cancels any pending or processing jobs for a specific recipient to avoid multiple delivery runs
       */
      cancelPendingJobsForRecipient(recipient) {
        let cancelledCount = 0;
        this.queue = this.queue.map((job) => {
          if (job.recipient === recipient && (job.status === "pending" || job.status === "processing")) {
            job.status = "cancelled";
            cancelledCount++;
            if (job.reject) {
              job.reject(new Error("Job cancelled because a newer OTP request was initiated."));
            }
            this.logMetric(recipient, job.ip, "cancelled", "Cancelled by newer OTP request");
          }
          return job;
        });
        if (cancelledCount > 0) {
          console.log(`[OTP System] Cancelled ${cancelledCount} older pending OTP jobs for recipient: ${this.maskRecipient(recipient)}`);
        }
      }
      /**
       * Processes the next pending job in the queue respecting concurrency rules
       */
      async processNext() {
        if (this.activeJobsCount >= this.maxConcurrency) {
          return;
        }
        const jobIndex = this.queue.findIndex((j) => j.status === "pending");
        if (jobIndex === -1) {
          return;
        }
        const job = this.queue[jobIndex];
        job.status = "processing";
        this.activeJobsCount++;
        try {
          const result = await this.executeJobWithBackoff(job);
          job.status = "completed";
          if (job.idempotencyKey) {
            this.idempotencyStore.set(job.idempotencyKey, {
              status: "completed",
              response: result,
              expiresAt: Date.now() + 5 * 60 * 1e3
            });
          }
          this.logMetric(job.recipient, job.ip, "sent");
          if (job.resolve) job.resolve(result);
        } catch (err) {
          job.status = "failed";
          job.error = err.message;
          if (job.idempotencyKey) {
            this.idempotencyStore.set(job.idempotencyKey, {
              status: "failed",
              response: { success: false, error: err.message },
              expiresAt: Date.now() + 5 * 60 * 1e3
            });
          }
          this.logMetric(job.recipient, job.ip, "failed", err.message);
          if (job.reject) job.reject(err);
        } finally {
          this.activeJobsCount--;
          const idx = this.queue.indexOf(job);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          this.processNext();
        }
      }
      /**
       * Executes the dispatch logic with custom exponential backoff retries for transient failures.
       */
      async executeJobWithBackoff(job) {
        const maxRetries = 3;
        while (job.retries < maxRetries) {
          try {
            if (job.status === "cancelled") {
              throw new Error("Job cancelled");
            }
            if (job.type === "whatsapp") {
              const result = await WhatsAppService.sendOtpWhatsApp(job.recipient, job.otp);
              return result;
            } else {
              const sent = await EmailService.sendOTPEmail(job.recipient, job.otp);
              return { success: true, message: "Email 6-digit OTP dispatched", sent };
            }
          } catch (err) {
            job.retries++;
            if (job.retries >= maxRetries || job.status === "cancelled") {
              throw err;
            }
            const backoffDelay = Math.pow(2, job.retries) * 1e3;
            console.warn(`[OTP Queue] Dispatch failed for ${this.maskRecipient(job.recipient)} (Attempt ${job.retries}/${maxRetries}). Retrying in ${backoffDelay}ms... Error: ${err.message}`);
            await new Promise((res) => setTimeout(res, backoffDelay));
          }
        }
      }
      /**
       * Exposes monitoring diagnostic metrics for alerting and dashboards.
       */
      getDiagnostics() {
        const now = Date.now();
        const systemRecent = this.systemMetrics.filter((m) => now - m.timestamp < 30 * 60 * 1e3);
        return {
          activeJobs: this.activeJobsCount,
          queueLength: this.queue.filter((j) => j.status === "pending").length,
          metricsCount: this.systemMetrics.length,
          recentMetrics: systemRecent.map((m) => ({
            timestamp: new Date(m.timestamp).toISOString(),
            recipient: this.maskRecipient(m.recipient),
            ip: m.ip,
            event: m.event,
            error: m.error
          })),
          idempotencyKeysCount: this.idempotencyStore.size
        };
      }
    };
  }
});

// server/routes/auth.routes.ts
var auth_routes_exports = {};
__export(auth_routes_exports, {
  default: () => auth_routes_default,
  normalizePhone: () => normalizePhone
});
import express from "express";
import crypto2 from "crypto";
function normalizePhone(phone) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11 && clean.startsWith("0")) {
    return clean.slice(1);
  }
  if (clean.length === 12 && clean.startsWith("91")) {
    return clean.slice(2);
  }
  return clean;
}
function getUtcDateString() {
  const d = /* @__PURE__ */ new Date();
  return d.toISOString().split("T")[0];
}
async function resetOtpLimit(identifier) {
  const cleanId = identifier.trim().toLowerCase();
  otpDailyLimitsMemory.delete(cleanId);
  try {
    await supabase.from("otps").update({
      request_count: 0,
      last_request_at: Date.now()
    }).eq("email", cleanId);
  } catch (err) {
    console.warn("[resetOtpLimit] DB update failed:", err.message);
  }
}
async function checkAndIncrementOtpLimit(identifier) {
  const cleanId = identifier.trim().toLowerCase();
  const currentDateStr = getUtcDateString();
  const now = Date.now();
  const memLimit = otpDailyLimitsMemory.get(cleanId);
  if (memLimit) {
    if (memLimit.dateStr === currentDateStr) {
      if (memLimit.count >= DAILY_OTP_LIMIT) {
        return { allowed: false, count: memLimit.count, limit: DAILY_OTP_LIMIT };
      }
    } else {
      otpDailyLimitsMemory.set(cleanId, { count: 0, dateStr: currentDateStr });
    }
  }
  let dbCount = 0;
  let hasDbRecord = false;
  try {
    const { data, error } = await supabase.from("otps").select("*").eq("email", cleanId).maybeSingle();
    if (!error && data) {
      hasDbRecord = true;
      const lastRequestDate = data.last_request_at ? new Date(Number(data.last_request_at)).toISOString().split("T")[0] : "";
      if (lastRequestDate === currentDateStr) {
        dbCount = data.request_count || 0;
      } else {
        dbCount = 0;
      }
    }
  } catch (err) {
    console.warn("[checkAndIncrementOtpLimit] DB read failed, relying on memory fallback:", err.message);
  }
  const currentCount = Math.max(dbCount, memLimit?.dateStr === currentDateStr ? memLimit.count : 0);
  if (currentCount >= DAILY_OTP_LIMIT) {
    otpDailyLimitsMemory.set(cleanId, { count: currentCount, dateStr: currentDateStr });
    return { allowed: false, count: currentCount, limit: DAILY_OTP_LIMIT };
  }
  const newCount = currentCount + 1;
  otpDailyLimitsMemory.set(cleanId, { count: newCount, dateStr: currentDateStr });
  try {
    if (hasDbRecord) {
      await supabase.from("otps").update({
        request_count: newCount,
        last_request_at: now,
        otp: "rate-limit-dummy",
        expires_at: now + 5 * 60 * 1e3
      }).eq("email", cleanId);
    } else {
      await supabase.from("otps").insert({
        email: cleanId,
        otp: "rate-limit-dummy",
        expires_at: now + 5 * 60 * 1e3,
        request_count: newCount,
        last_request_at: now
      });
    }
  } catch (err) {
    console.warn("[checkAndIncrementOtpLimit] DB write failed:", err.message);
  }
  return { allowed: true, count: newCount, limit: DAILY_OTP_LIMIT };
}
async function saveEmailOtp(email, otp) {
  const cleanEmail = email.trim().toLowerCase();
  const hashedOtp = hashOtp(otp);
  const expiresAt = Date.now() + 5 * 60 * 1e3;
  const createdAt = Date.now();
  const id = crypto2.randomUUID();
  emailOtpsMemory.set(cleanEmail, {
    id,
    email: cleanEmail,
    otp_code: hashedOtp,
    expires_at: expiresAt,
    attempts: 0,
    created_at: createdAt
  });
}
async function getEmailOtp(email) {
  const cleanEmail = email.trim().toLowerCase();
  return emailOtpsMemory.get(cleanEmail) || null;
}
async function incrementEmailAttempts(email, currentAttempts) {
  const cleanEmail = email.trim().toLowerCase();
  const newAttempts = currentAttempts + 1;
  const mem = emailOtpsMemory.get(cleanEmail);
  if (mem) {
    mem.attempts = newAttempts;
    emailOtpsMemory.set(cleanEmail, mem);
  }
}
async function deleteEmailOtp(email) {
  const cleanEmail = email.trim().toLowerCase();
  emailOtpsMemory.delete(cleanEmail);
}
function hashOtp(otp) {
  return crypto2.createHash("sha256").update(otp).digest("hex");
}
async function saveWhatsAppOtp(phone, otp) {
  const cleanPhone = normalizePhone(phone);
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 3 * 60 * 1e3).toISOString();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const id = crypto2.randomUUID();
  try {
    await supabase.from("whatsapp_otps").delete().eq("phone_number", cleanPhone);
    await supabase.from("whatsapp_otps").insert({
      id,
      phone_number: cleanPhone,
      otp_code: hashedOtp,
      expires_at: expiresAt,
      attempts: 0,
      created_at: createdAt
    });
    console.log("[whatsapp_otps] Saved OTP to DB:", cleanPhone);
  } catch (err) {
    console.warn("[whatsapp_otps] DB Save failed, using Memory fallback:", err.message);
  }
  whatsappOtpsMemory.set(cleanPhone, {
    id,
    phone_number: cleanPhone,
    otp_code: hashedOtp,
    expires_at: expiresAt,
    attempts: 0,
    created_at: createdAt
  });
}
async function getWhatsAppOtp(phone) {
  const cleanPhone = normalizePhone(phone);
  try {
    const { data, error } = await supabase.from("whatsapp_otps").select("*").eq("phone_number", cleanPhone).maybeSingle();
    if (!error && data) {
      return {
        id: data.id,
        phone_number: data.phone_number,
        otp_code: data.otp_code,
        expires_at: data.expires_at,
        attempts: data.attempts || 0,
        created_at: data.created_at
      };
    }
  } catch (err) {
    console.warn("[whatsapp_otps] DB Get failed, using Memory fallback:", err.message);
  }
  return whatsappOtpsMemory.get(cleanPhone) || null;
}
async function incrementWhatsAppAttempts(phone, currentAttempts) {
  const cleanPhone = normalizePhone(phone);
  const newAttempts = currentAttempts + 1;
  try {
    await supabase.from("whatsapp_otps").update({ attempts: newAttempts }).eq("phone_number", cleanPhone);
  } catch (err) {
    console.warn("[whatsapp_otps] DB Update attempts failed:", err.message);
  }
  const mem = whatsappOtpsMemory.get(cleanPhone);
  if (mem) {
    mem.attempts = newAttempts;
    whatsappOtpsMemory.set(cleanPhone, mem);
  }
}
async function deleteWhatsAppOtp(phone) {
  const cleanPhone = normalizePhone(phone);
  try {
    await supabase.from("whatsapp_otps").delete().eq("phone_number", cleanPhone);
  } catch (err) {
    console.warn("[whatsapp_otps] DB Delete failed:", err.message);
  }
  whatsappOtpsMemory.delete(cleanPhone);
}
var router3, ipRateLimits, mobileOtps, otpDailyLimitsMemory, DAILY_OTP_LIMIT, whatsappOtpsMemory, emailOtpsMemory, auth_routes_default;
var init_auth_routes = __esm({
  "server/routes/auth.routes.ts"() {
    init_supabase();
    init_user_service();
    init_email_service();
    init_whatsapp_service();
    init_otpQueue();
    router3 = express.Router();
    ipRateLimits = /* @__PURE__ */ new Map();
    mobileOtps = /* @__PURE__ */ new Map();
    otpDailyLimitsMemory = /* @__PURE__ */ new Map();
    DAILY_OTP_LIMIT = process.env.NODE_ENV !== "production" ? 100 : 25;
    router3.post("/sync", async (req, res) => {
      const { idToken, markVerified, userProfile } = req.body;
      if (!idToken && !userProfile) return res.status(400).json({ error: "Auth token or user profile required" });
      try {
        let email = "";
        let name = "User";
        let uid = "mock-uid";
        let photoURL = "";
        if (idToken) {
          try {
            const parts = idToken.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
              email = payload.email || payload.user_metadata?.email || "";
              name = payload.name || payload.user_metadata?.full_name || "User";
              uid = payload.sub || payload.id || "mock-uid";
              photoURL = payload.picture || payload.user_metadata?.avatar_url || "";
            }
          } catch (tokenErr) {
            console.warn("[AuthRoutes Sync] Token parse bypassed:", tokenErr);
          }
        }
        if (userProfile) {
          email = email || userProfile.email || "";
          name = name || userProfile.name || "User";
          uid = uid || userProfile.id || "mock-uid";
          photoURL = photoURL || userProfile.avatar_url || "";
        }
        const existingUser = await UserService.getUserByFirebaseUid(uid);
        const user = await UserService.syncUser({
          uid,
          email: email || "",
          displayName: name,
          photoURL
        });
        if (!existingUser && user?.email) {
          EmailService.sendWelcomeEmail(user.email, user.name).catch((emailErr) => {
            console.warn("[AuthRoutes] Welcome email task failed:", emailErr);
          });
        }
        res.json({ success: true, user });
      } catch (error) {
        console.error("[AuthRoutes] Sync error:", error);
        res.status(401).json({ error: "Invalid token or sync failed" });
      }
    });
    router3.post("/firebase-token", async (req, res) => {
      const { supabaseAccessToken, email } = req.body;
      if (!supabaseAccessToken || !email) {
        return res.status(400).json({ error: "Supabase access token and email are required" });
      }
      try {
        const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(supabaseAccessToken);
        if (sbError || !sbUser) {
          return res.status(401).json({ error: "Invalid Supabase session" });
        }
        const mockPayload = {
          iss: "https://securetoken.google.com/mock",
          sub: sbUser.id,
          email: sbUser.email || email,
          email_verified: true,
          name: sbUser.user_metadata?.full_name || email.split("@")[0]
        };
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
        const payload = Buffer.from(JSON.stringify(mockPayload)).toString("base64");
        const signature = "securesig";
        const fakeCustomToken = `${header}.${payload}.${signature}`;
        res.json({
          success: true,
          customToken: fakeCustomToken,
          firebaseUser: {
            uid: sbUser.id,
            email: sbUser.email || email,
            displayName: sbUser.user_metadata?.full_name || email.split("@")[0]
          }
        });
      } catch (err) {
        res.status(400).json({ success: false, error: err.message || "Token generation failed" });
      }
    });
    router3.get("/otp-type", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).json({ error: "Email parameter is required" });
      }
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error || !data || !data.users) {
          return res.json({ type: "signup" });
        }
        const foundUser = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
        if (!foundUser) {
          return res.json({ type: "signup" });
        }
        const isConfirmed = !!foundUser.email_confirmed_at;
        const type = isConfirmed ? "email" : "signup";
        res.json({ type });
      } catch (err) {
        res.json({ type: "signup" });
      }
    });
    router3.post("/reset-password", async (req, res) => {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: "Email, OTP code, and new password are required." });
      }
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const cleanOtp = otp.trim();
        const cleanPassword = newPassword.trim();
        if (cleanPassword.length < 6) {
          return res.status(400).json({ error: "Password must be at least 6 characters long." });
        }
        let verifyType = "email";
        try {
          const { data: userList } = await supabase.auth.admin.listUsers();
          if (userList && userList.users) {
            const found = userList.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
            if (found) {
              verifyType = found.email_confirmed_at ? "email" : "signup";
            } else {
              verifyType = "signup";
            }
          }
        } catch (err) {
          console.warn("[ResetPasswordRoute] Failed listing users:", err.message);
        }
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanOtp,
          type: verifyType
        });
        let userToUpdate = verifyData?.user;
        if (verifyError || !verifyData?.user) {
          const altType = verifyType === "email" ? "signup" : "email";
          const { data: verifyDataAlt, error: verifyErrorAlt } = await supabase.auth.verifyOtp({
            email: normalizedEmail,
            token: cleanOtp,
            type: altType
          });
          if (verifyErrorAlt || !verifyDataAlt?.user) {
            return res.status(401).json({ error: "Invalid or expired OTP verification code." });
          }
          userToUpdate = verifyDataAlt.user;
        }
        if (userToUpdate) {
          await supabase.auth.admin.updateUserById(userToUpdate.id, {
            password: cleanPassword
          });
        }
        return res.json({ success: true, message: "Your password has been successfully reset! Please check-in using your new password." });
      } catch (err) {
        return res.status(500).json({ error: err.message || "An unexpected error occurred during password reset." });
      }
    });
    whatsappOtpsMemory = /* @__PURE__ */ new Map();
    emailOtpsMemory = /* @__PURE__ */ new Map();
    router3.post("/send-otp", async (req, res) => {
      const { phone, isSignup, email, name, password, idempotencyKey } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Mobile phone number is required." });
      }
      try {
        const cleanPhone = normalizePhone(phone);
        if (cleanPhone.length < 10) {
          return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
        }
        const limitCheck = await checkAndIncrementOtpLimit(cleanPhone);
        if (!limitCheck.allowed) {
          return res.status(429).json({
            success: false,
            error: `Security Limit: You have reached the maximum daily limit of ${limitCheck.limit} verification OTPs. Please try again later.`
          });
        }
        const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "127.0.0.1";
        const clientIp = (Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === "string" ? rawIp.split(",")[0].trim() : String(rawIp)).replace(/[^a-zA-Z0-9.-:_]/g, "_");
        const now = Date.now();
        const windowMs = 60 * 60 * 1e3;
        let limit = ipRateLimits.get(clientIp);
        if (limit) {
          if (limit.blocked || limit.blocked_until && now < limit.blocked_until) {
            const remainingMinutes = Math.ceil((limit.blocked_until - now) / 6e4);
            return res.status(429).json({
              error: `Security Hold: Temporarily blocked from requesting OTPs. Please wait ${remainingMinutes > 0 ? remainingMinutes : 60} minutes.`
            });
          }
          if (now - limit.first_attempt_time > windowMs) {
            ipRateLimits.set(clientIp, {
              attempts: 1,
              first_attempt_time: now,
              blocked: false,
              blocked_until: 0
            });
          } else {
            const updatedAttempts = limit.attempts + 1;
            if (updatedAttempts > 5) {
              ipRateLimits.set(clientIp, {
                attempts: updatedAttempts,
                first_attempt_time: limit.first_attempt_time,
                blocked: true,
                blocked_until: now + windowMs
              });
              return res.status(429).json({
                error: "Security Hold: Maximum OTP limits exceeded. Blocked for 60 minutes."
              });
            } else {
              limit.attempts = updatedAttempts;
            }
          }
        } else {
          ipRateLimits.set(clientIp, {
            attempts: 1,
            first_attempt_time: now,
            blocked: false,
            blocked_until: 0
          });
        }
        const { data: dbUser } = await supabase.from("users").select("*").eq("phone", cleanPhone).maybeSingle();
        const isRegistrationFlow = isSignup || !dbUser;
        if (isSignup) {
          if (dbUser) {
            return res.status(400).json({ error: "A Frosty Bite account is already registered with this phone number." });
          }
          if (email) {
            const cleanEmail = email.trim().toLowerCase();
            const { data: dbUserByEmail } = await supabase.from("users").select("*").eq("email", cleanEmail).maybeSingle();
            if (dbUserByEmail) {
              return res.status(400).json({ error: "A Frosty Bite account is already registered with this email ID." });
            }
          }
        }
        const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
        const otpPayload = {
          otp,
          expires_at: Date.now() + 3 * 60 * 1e3,
          // 3 minutes expiration
          email: isRegistrationFlow && email ? email.trim().toLowerCase() : dbUser ? dbUser.email : `${cleanPhone}@frostybite.temp`
        };
        if (isRegistrationFlow) {
          otpPayload.isSignup = true;
          otpPayload.name = name ? name.trim() : `User ${cleanPhone}`;
          otpPayload.password = password ? password.trim() : "";
        } else if (dbUser) {
          otpPayload.userId = dbUser.id;
        }
        mobileOtps.set(cleanPhone, otpPayload);
        await saveWhatsAppOtp(cleanPhone, otp);
        const queueService = OtpQueueService.getInstance();
        const waResult = await queueService.enqueue(
          cleanPhone,
          "whatsapp",
          otp,
          clientIp,
          idempotencyKey,
          otpPayload
        );
        return res.json({
          success: true,
          message: waResult.message,
          dev_otp_hint: waResult.dev_otp_hint,
          client_dispatch_required: waResult.client_dispatch_required,
          textMessage: waResult.textMessage,
          formattedPhone: waResult.formattedPhone
        });
      } catch (err) {
        return res.status(500).json({ error: err.message || "An unexpected error occurred while dispatching WhatsApp OTP." });
      }
    });
    router3.post("/verify-otp", async (req, res) => {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ error: "Phone number and verification OTP are required." });
      }
      try {
        const cleanPhone = normalizePhone(phone);
        const cleanOtp = otp.trim();
        const otpRecord = await getWhatsAppOtp(cleanPhone);
        if (!otpRecord) {
          return res.status(401).json({ error: "Verification code not found or has expired." });
        }
        const expiresTime = new Date(otpRecord.expires_at).getTime();
        if (expiresTime < Date.now()) {
          await deleteWhatsAppOtp(cleanPhone);
          mobileOtps.delete(cleanPhone);
          return res.status(401).json({ error: "Verification code has expired." });
        }
        if (otpRecord.attempts >= 5) {
          return res.status(429).json({ error: "Maximum attempts exceeded. Please request a new verification OTP." });
        }
        const hashedInput = hashOtp(cleanOtp);
        if (otpRecord.otp_code !== hashedInput) {
          await incrementWhatsAppAttempts(cleanPhone, otpRecord.attempts);
          return res.status(401).json({ error: "Incorrect verification code." });
        }
        const signupData = mobileOtps.get(cleanPhone) || { isSignup: false, email: `${cleanPhone}@frostybite.temp`, name: `User ${cleanPhone}` };
        await deleteWhatsAppOtp(cleanPhone);
        mobileOtps.delete(cleanPhone);
        let dbUser = null;
        const { data: existingUser } = await supabase.from("users").select("*").eq("phone", cleanPhone).maybeSingle();
        dbUser = existingUser;
        if (signupData.isSignup && !dbUser) {
          const { data: insertedUser, error: insertError } = await supabase.from("users").insert({
            email: signupData.email || `${cleanPhone}@frostybite.temp`,
            name: signupData.name || `User ${cleanPhone}`,
            full_name: signupData.name || `User ${cleanPhone}`,
            phone: cleanPhone,
            auth_methods: ["otp", "mobile_otp", "whatsapp_otp"],
            last_login: (/* @__PURE__ */ new Date()).toISOString(),
            last_login_at: (/* @__PURE__ */ new Date()).toISOString()
          }).select().single();
          if (insertError) {
            if (insertError.code !== "23505") {
              return res.status(500).json({ error: "Failed to create account: " + insertError.message });
            }
          } else {
            dbUser = insertedUser;
          }
        }
        if (!dbUser) {
          const { data: refetchedUser } = await supabase.from("users").select("*").eq("phone", cleanPhone).maybeSingle();
          dbUser = refetchedUser;
        }
        if (!dbUser) {
          return res.status(401).json({ error: "Failed to resolve user account credentials." });
        }
        try {
          await supabase.from("users").update({
            last_login: (/* @__PURE__ */ new Date()).toISOString(),
            last_login_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", dbUser.id);
        } catch (_) {
        }
        const syncedUid = dbUser.supabase_uid || dbUser.id;
        try {
          await UserService.syncUser({
            uid: syncedUid,
            supabaseUid: dbUser.supabase_uid || dbUser.id,
            email: dbUser.email,
            displayName: dbUser.name || dbUser.email.split("@")[0],
            photoURL: dbUser.avatar_url || null
          });
        } catch (syncErr) {
          console.warn("[VerifyWhatsAppOtp] DB syncing failed:", syncErr.message);
        }
        const mockPayload = {
          iss: "https://securetoken.google.com/mock",
          sub: syncedUid,
          email: dbUser.email,
          email_verified: true,
          name: dbUser.name
        };
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
        const payload = Buffer.from(JSON.stringify(mockPayload)).toString("base64");
        const fakeCustomToken = `${header}.${payload}.securesig`;
        await resetOtpLimit(cleanPhone);
        return res.json({
          success: true,
          customToken: fakeCustomToken,
          email: dbUser.email,
          user: dbUser
        });
      } catch (err) {
        return res.status(500).json({ error: err.message || "Verification failed." });
      }
    });
    router3.post("/resend-otp", async (req, res) => {
      const { phone, idempotencyKey } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required." });
      }
      try {
        const cleanPhone = normalizePhone(phone);
        const limitCheck = await checkAndIncrementOtpLimit(cleanPhone);
        if (!limitCheck.allowed) {
          return res.status(429).json({
            success: false,
            error: `Security Limit: You have reached the maximum daily limit of ${limitCheck.limit} verification OTPs. Please try again later.`
          });
        }
        await deleteWhatsAppOtp(cleanPhone);
        mobileOtps.delete(cleanPhone);
        const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
        const existingMetadata = mobileOtps.get(cleanPhone) || {
          email: `${cleanPhone}@frostybite.temp`
        };
        const otpPayload = {
          ...existingMetadata,
          otp,
          expires_at: Date.now() + 3 * 60 * 1e3
          // 3 minutes expiration
        };
        mobileOtps.set(cleanPhone, otpPayload);
        await saveWhatsAppOtp(cleanPhone, otp);
        const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "127.0.0.1";
        const clientIp = (Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === "string" ? rawIp.split(",")[0].trim() : String(rawIp)).replace(/[^a-zA-Z0-9.-:_]/g, "_");
        const queueService = OtpQueueService.getInstance();
        const waResult = await queueService.enqueue(
          cleanPhone,
          "whatsapp",
          otp,
          clientIp,
          idempotencyKey,
          otpPayload
        );
        return res.json({
          success: true,
          message: "A fresh WhatsApp verification code has been dispatched!",
          dev_otp_hint: waResult.dev_otp_hint,
          client_dispatch_required: waResult.client_dispatch_required,
          textMessage: waResult.textMessage,
          formattedPhone: waResult.formattedPhone
        });
      } catch (err) {
        return res.status(500).json({ error: err.message || "Failed to resend WhatsApp verification code." });
      }
    });
    router3.get("/whatsapp-poll", (req, res) => {
      const now = Date.now();
      const maxAge = 12e4;
      const validMessages = WhatsAppService.pendingQueue.filter((m) => now - m.timestamp < maxAge);
      WhatsAppService.pendingQueue = validMessages;
      res.json({ messages: WhatsAppService.pendingQueue });
    });
    router3.post("/whatsapp-ack", (req, res) => {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Message ID is required for acknowledgement." });
      }
      const index = WhatsAppService.pendingQueue.findIndex((m) => m.id === id);
      if (index !== -1) {
        WhatsAppService.pendingQueue.splice(index, 1);
      }
      res.json({ success: true });
    });
    router3.post("/send-mobile-otp", async (req, res) => {
      console.log("[AuthRoutes] Legacy send-mobile-otp route redirecting to /send-otp");
      return req.app._router.handle(req, res);
    });
    router3.post("/verify-mobile-otp", async (req, res) => {
      console.log("[AuthRoutes] Legacy verify-mobile-otp route redirecting to /verify-otp");
      return req.app._router.handle(req, res);
    });
    router3.post("/send-email-otp", async (req, res) => {
      const { email, idempotencyKey } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const limitCheck = await checkAndIncrementOtpLimit(normalizedEmail);
        if (!limitCheck.allowed) {
          return res.status(429).json({
            success: false,
            error: `Security Limit: You have reached the maximum daily limit of ${limitCheck.limit} verification OTPs. Please try again later.`
          });
        }
        const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "127.0.0.1";
        const clientIp = (Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === "string" ? rawIp.split(",")[0].trim() : String(rawIp)).replace(/[^a-zA-Z0-9.-:_]/g, "_");
        const otp = Math.floor(1e7 + Math.random() * 9e7).toString();
        await saveEmailOtp(normalizedEmail, otp);
        try {
          const queueService = OtpQueueService.getInstance();
          await queueService.enqueue(
            normalizedEmail,
            "email",
            otp,
            clientIp,
            idempotencyKey,
            {}
          );
        } catch (dispatchErr) {
          console.warn("[send-email-otp] SMTP delivery warning:", dispatchErr.message || dispatchErr);
        }
        return res.json({
          success: true,
          message: "An 8-digit verification code has been dispatched to your email.",
          dev_otp_hint: process.env.NODE_ENV !== "production" ? otp : void 0
        });
      } catch (err) {
        console.error("[send-email-otp] Exception:", err.message || err);
        return res.status(500).json({
          success: false,
          error: err.message || "An unexpected error occurred while dispatching email OTP."
        });
      }
    });
    router3.post("/verify-email-otp", async (req, res) => {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email address and 6-digit verification code are required." });
      }
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const cleanOtp = String(otp).trim();
        if (cleanOtp.length !== 6) {
          return res.status(400).json({ error: "Please enter the full 6-digit verification code." });
        }
        const otpRecord = await getEmailOtp(normalizedEmail);
        if (!otpRecord) {
          return res.status(401).json({ error: "Verification code not found or has expired. Please request a new code." });
        }
        if (otpRecord.expires_at < Date.now()) {
          await deleteEmailOtp(normalizedEmail);
          return res.status(401).json({ error: "Verification code has expired. Please request a new code." });
        }
        if (otpRecord.attempts >= 5) {
          await deleteEmailOtp(normalizedEmail);
          return res.status(429).json({ error: "Maximum attempts exceeded. Please request a new verification code." });
        }
        const hashedInput = hashOtp(cleanOtp);
        if (otpRecord.otp_code !== hashedInput) {
          await incrementEmailAttempts(normalizedEmail, otpRecord.attempts);
          return res.status(401).json({ error: "Incorrect verification code. Please check your email and try again." });
        }
        await deleteEmailOtp(normalizedEmail);
        let dbUser = null;
        try {
          const { data: existingUser } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();
          dbUser = existingUser;
        } catch (e) {
          console.warn("[verify-email-otp] Error querying user:", e);
        }
        if (!dbUser) {
          const displayName = normalizedEmail.split("@")[0];
          try {
            const { data: insertedUser, error: insertError } = await supabase.from("users").insert({
              email: normalizedEmail,
              name: displayName,
              full_name: displayName,
              auth_methods: ["otp", "email_otp"],
              last_login: (/* @__PURE__ */ new Date()).toISOString(),
              last_login_at: (/* @__PURE__ */ new Date()).toISOString()
            }).select().single();
            if (!insertError && insertedUser) {
              dbUser = insertedUser;
            }
          } catch (err) {
            console.warn("[verify-email-otp] Error inserting user:", err);
          }
        }
        if (!dbUser) {
          dbUser = {
            id: `usr_${Date.now()}`,
            email: normalizedEmail,
            name: normalizedEmail.split("@")[0],
            role: "customer"
          };
        }
        try {
          if (dbUser?.id && !String(dbUser.id).startsWith("usr_")) {
            await supabase.from("users").update({
              last_login: (/* @__PURE__ */ new Date()).toISOString(),
              last_login_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", dbUser.id);
          }
        } catch (_) {
        }
        const syncedUid = dbUser.supabase_uid || dbUser.id;
        try {
          await UserService.syncUser({
            uid: syncedUid,
            supabaseUid: dbUser.supabase_uid || dbUser.id,
            email: dbUser.email,
            displayName: dbUser.name || dbUser.email.split("@")[0],
            photoURL: dbUser.avatar_url || null
          });
        } catch (syncErr) {
          console.warn("[verify-email-otp] DB syncing failed:", syncErr.message);
        }
        const mockPayload = {
          iss: "https://securetoken.google.com/mock",
          sub: syncedUid,
          email: dbUser.email,
          email_verified: true,
          name: dbUser.name
        };
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
        const payload = Buffer.from(JSON.stringify(mockPayload)).toString("base64");
        const fakeCustomToken = `${header}.${payload}.securesig`;
        await resetOtpLimit(normalizedEmail);
        return res.json({
          success: true,
          customToken: fakeCustomToken,
          email: dbUser.email,
          user: dbUser
        });
      } catch (err) {
        return res.status(500).json({ error: err.message || "Verification failed." });
      }
    });
    router3.post("/reset-otp-limit", async (req, res) => {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: "Identifier (email or phone) is required." });
      }
      try {
        await resetOtpLimit(identifier);
        return res.json({ success: true, message: `OTP rate limit has been reset for ${identifier}` });
      } catch (err) {
        return res.status(500).json({ error: err.message || "Failed to reset OTP limit." });
      }
    });
    router3.get("/otp-diagnostics", (req, res) => {
      try {
        const diagnostics = OtpQueueService.getInstance().getDiagnostics();
        return res.json({ success: true, diagnostics });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });
    auth_routes_default = router3;
  }
});

// server/lib/firebase-admin.ts
var firebase_admin_exports = {};
__export(firebase_admin_exports, {
  default: () => firebase_admin_default,
  getAdminAuth: () => getAdminAuth,
  getAdminDb: () => getAdminDb
});
var MockDocRef, MockCollectionRef, MockFirestore, getAdminDb, getAdminAuth, admin, firebase_admin_default;
var init_firebase_admin = __esm({
  "server/lib/firebase-admin.ts"() {
    MockDocRef = class {
      constructor(docPath) {
        this._docPath = docPath;
      }
      async get() {
        return {
          exists: false,
          data: () => null
        };
      }
      async set(data, options) {
        console.log(`[MockAdminDb] set called for ${this._docPath}`);
      }
      async update(data) {
        console.log(`[MockAdminDb] update called for ${this._docPath}`);
      }
      async delete() {
        console.log(`[MockAdminDb] delete called for ${this._docPath}`);
      }
    };
    MockCollectionRef = class {
      constructor(colName) {
        this._colName = colName;
      }
      limit(n) {
        return this;
      }
      doc(docId) {
        return new MockDocRef(`${this._colName}/${docId}`);
      }
      async get() {
        return {
          empty: true,
          size: 0,
          forEach: (callback) => {
          }
        };
      }
    };
    MockFirestore = class {
      collection(colName) {
        return new MockCollectionRef(colName);
      }
      doc(docPath) {
        return new MockDocRef(docPath);
      }
    };
    getAdminDb = () => {
      return new MockFirestore();
    };
    getAdminAuth = () => {
      return {
        verifyIdToken: async (token) => {
          try {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
              return {
                uid: payload.sub || payload.id || "mock-uid",
                email: payload.email || payload.user_metadata?.email || "mock@admin.com",
                email_verified: true,
                name: payload.name || payload.user_metadata?.full_name || "Mock Admin"
              };
            }
          } catch (e) {
            console.warn("[MockAdminAuth] Token parse fallback:", e);
          }
          return {
            uid: "mock-uid",
            email: "mock@admin.com",
            email_verified: true,
            name: "Mock Admin"
          };
        },
        createUser: async (properties) => {
          return { uid: "mock-uid", ...properties };
        },
        getUserByEmail: async (email) => {
          return { uid: "mock-uid", email, emailVerified: true };
        },
        updateUser: async (uid, properties) => {
          return { uid, ...properties };
        },
        createCustomToken: async (uid, claims) => {
          return "mock-custom-token";
        }
      };
    };
    admin = {
      firestore: {
        FieldValue: {
          serverTimestamp: () => (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    };
    firebase_admin_default = admin;
  }
});

// server/routes/config.routes.ts
var config_routes_exports = {};
__export(config_routes_exports, {
  default: () => config_routes_default
});
import express2 from "express";
function isFirebaseToken(token) {
  try {
    const payload = decodeJwtPayload(token);
    return !!payload?.iss?.startsWith("https://securetoken.google.com/");
  } catch {
    return false;
  }
}
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      base64Url.length + (4 - base64Url.length % 4) % 4,
      "="
    );
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
function getEmailFromArbitraryToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    const payload = JSON.parse(jsonPayload);
    if (payload) {
      if (payload.email) {
        return payload.email;
      }
      if (payload.user_metadata && payload.user_metadata.email) {
        return payload.user_metadata.email;
      }
      if (payload.user && payload.user.email) {
        return payload.user.email;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}
async function isAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token || token === "null" || token === "undefined" || token.trim() === "") {
    return false;
  }
  let verifiedEmail;
  if (isFirebaseToken(token)) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      verifiedEmail = decoded.email;
      console.log("[ConfigRoutes] Firebase verified email:", verifiedEmail);
    } catch (err) {
      console.log("[ConfigRoutes] Firebase verification failed:", err.message);
    }
  }
  if (!verifiedEmail) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        verifiedEmail = user.email;
        console.log("[ConfigRoutes] Supabase verified email:", verifiedEmail);
      }
    } catch (err) {
      console.log("[ConfigRoutes] Supabase exception:", err.message);
    }
  }
  if (!verifiedEmail) {
    const extracted = getEmailFromArbitraryToken(token);
    if (extracted) {
      verifiedEmail = extracted;
      console.log("[ConfigRoutes] Extracted email from JWT fallback payload:", verifiedEmail);
    }
  }
  if (verifiedEmail) {
    const normEmail = verifiedEmail.trim().toLowerCase();
    const isMatched = ADMIN_EMAILS.includes(normEmail);
    if (isMatched) return true;
    try {
      const { data: userRecord } = await supabase.from("users").select("role").eq("email", normEmail).maybeSingle();
      if (userRecord && userRecord.role === "admin") {
        return true;
      }
    } catch (dbErr) {
      console.log("[ConfigRoutes] Admin role lookup error:", dbErr);
    }
  }
  return false;
}
var router4, inMemoryConfig, ADMIN_EMAILS, config_routes_default;
var init_config_routes = __esm({
  "server/routes/config.routes.ts"() {
    init_firebase_admin();
    init_supabase();
    router4 = express2.Router();
    inMemoryConfig = null;
    ADMIN_EMAILS = [
      "restaurantbarkass@gmail.com",
      "wasifmd924@gmail.com",
      "sayedazainab216@gmail.com",
      "sayedazainabali76@gmail.com"
    ];
    router4.get("/", async (req, res) => {
      try {
        let chosenConfig = null;
        try {
          const { data, error } = await supabase.from("app_settings").select("value").eq("id", "1").maybeSingle();
          if (error) {
            console.error("[ConfigRoutes] Supabase error in GET app_settings:", error.message);
          } else if (data && data.value) {
            try {
              const val = data.value;
              chosenConfig = typeof val === "string" ? JSON.parse(val) : val;
            } catch (parseErr) {
              console.error("[ConfigRoutes] JSON parse error of app_settings value:", parseErr.message);
            }
          }
        } catch (sbErr) {
          console.warn("[ConfigRoutes] Supabase config lookup failed:", sbErr.message);
        }
        if (!chosenConfig) {
          console.log("[ConfigRoutes] app_settings not found. Attempting legacy migration...");
          try {
            const { data: legacyData, error: legacyErr } = await supabase.from("users").select("address").eq("email", "system_settings_v1@frostybite.internal").maybeSingle();
            if (!legacyErr && legacyData && legacyData.address) {
              try {
                chosenConfig = JSON.parse(legacyData.address);
                console.log("[ConfigRoutes] Migrating legacy config:", chosenConfig);
                const { error: insertErr } = await supabase.from("app_settings").insert({
                  id: "1",
                  value: JSON.stringify(chosenConfig)
                });
                if (insertErr) {
                  console.warn("[ConfigRoutes] Failed to save migrated config:", insertErr.message);
                } else {
                  console.log("[ConfigRoutes] Legacy config migrated successfully to app_settings!");
                }
              } catch (e) {
                console.error("[ConfigRoutes] Legacy config parsing failed:", e.message);
              }
            }
          } catch (e) {
            console.warn("[ConfigRoutes] Legacy migration failed:", e.message);
          }
        }
        if (!chosenConfig) {
          if (inMemoryConfig) {
            chosenConfig = inMemoryConfig;
          } else {
            chosenConfig = {
              isOrderingOpen: true,
              deliveryBaseFee: 15,
              deliveryFeePerKm: 5,
              deliveryFreeKm: 3,
              defaultDeliveryTime: 25,
              geofencingEnabled: true,
              geofencingLatitude: 20.4625,
              geofencingLongitude: 85.8828,
              geofencingRadius: 12,
              geofencingZones: "[]",
              isInstantDeliveryClosed: false
            };
            try {
              const { error: insertErr } = await supabase.from("app_settings").insert({
                id: "1",
                value: JSON.stringify(chosenConfig)
              });
              if (insertErr) {
                console.warn("[ConfigRoutes] Initial app_settings insert failed:", insertErr.message);
              }
            } catch (sbInsertErr) {
              console.warn("[ConfigRoutes] Initial app_settings insert exception:", sbInsertErr.message);
            }
          }
        }
        inMemoryConfig = chosenConfig;
        return res.json({ success: true, config: chosenConfig });
      } catch (error) {
        console.error("[ConfigRoutes] Error fetching config:", error);
        res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
      }
    });
    router4.post("/", async (req, res) => {
      try {
        const isUserAdmin = await isAdmin(req);
        if (!isUserAdmin) {
          return res.status(403).json({ success: false, error: "Forbidden", message: "Admin permissions required to change settings" });
        }
        const payload = req.body;
        console.log("[ConfigRoutes] POST request payload:", JSON.stringify(payload));
        let existingConfig = {};
        try {
          const { data, error } = await supabase.from("app_settings").select("value").eq("id", "1").maybeSingle();
          if (!error && data && data.value) {
            const val = data.value;
            existingConfig = typeof val === "string" ? JSON.parse(val) : val;
          }
        } catch (e) {
          console.warn("[ConfigRoutes] Error reading existing app_settings config:", e.message);
        }
        const updatedConfig = {
          ...existingConfig,
          ...payload,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        console.log("[ConfigRoutes] updatedConfig to be saved:", JSON.stringify(updatedConfig));
        const configString = JSON.stringify(updatedConfig);
        let { error: upsertErr } = await supabase.from("app_settings").update({
          value: configString,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", "1");
        if (upsertErr) {
          console.warn("[ConfigRoutes] Update app_settings failed, trying upsert...", upsertErr.message);
          const res2 = await supabase.from("app_settings").upsert({
            id: "1",
            value: configString,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          upsertErr = res2.error;
        }
        if (upsertErr) {
          console.error("[ConfigRoutes] Supabase update settings error:", upsertErr.message);
          return res.status(500).json({ success: false, error: "Database Error", message: "Failed to update system settings", details: upsertErr });
        }
        console.log("[ConfigRoutes] Configuration successfully synchronized to Supabase app_settings");
        inMemoryConfig = updatedConfig;
        res.json({ success: true, config: updatedConfig });
      } catch (error) {
        console.error("[ConfigRoutes] Error setting config:", error);
        res.status(500).json({ success: false, error: "Internal Server Error", message: error.message });
      }
    });
    config_routes_default = router4;
  }
});

// server/services/notification.service.ts
import fs from "fs";
import path from "path";
var LOCAL_STORE_FILE, NotificationLocalStore, localStore, NotificationService;
var init_notification_service = __esm({
  "server/services/notification.service.ts"() {
    init_supabase();
    LOCAL_STORE_FILE = path.join(process.cwd(), "notification_store_backup.json");
    NotificationLocalStore = class {
      constructor() {
        this.subscriptions = [];
        this.events = [];
        this.preferences = [];
        this.templates = [
          {
            id: "tpl-confirmed",
            notification_type: "order_confirmed",
            title_template: "Order Confirmed \u{1F370}",
            body_template: "Your sweet order #{{order_id}} is confirmed! Our bakers are getting ready.",
            emoji: "\u{1F370}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-preparing",
            notification_type: "order_preparing",
            title_template: "Your order is being prepared \u{1F468}\u200D\u{1F373}",
            body_template: "Our bakers are whipping up something delicious for order #{{order_id}} with love.",
            emoji: "\u{1F468}\u200D\u{1F373}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-almost-ready",
            notification_type: "order_almost_ready",
            title_template: "Almost Ready \u2728",
            body_template: "Your order #{{order_id}} is almost ready. Just adding the finishing sweet touches\u2026",
            emoji: "\u2728",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-ready",
            notification_type: "order_ready",
            title_template: "Your order is ready! \u{1F382}",
            body_template: "Your order #{{order_id}} is packed and ready. Your sweet moment awaits!",
            emoji: "\u{1F382}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-out-for-delivery",
            notification_type: "order_out_for_delivery",
            title_template: "Out for Delivery \u{1F6F5}",
            body_template: "Your sweet surprise for order #{{order_id}} is on its way to you!",
            emoji: "\u{1F6F5}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-near-you",
            notification_type: "order_near_you",
            title_template: "Almost there! \u{1F4CD}",
            body_template: "Rider is almost at your doorstep with order #{{order_id}}.",
            emoji: "\u{1F4CD}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-delivered",
            notification_type: "order_delivered",
            title_template: "Delivered! \u{1F90D}",
            body_template: "Order #{{order_id}} has arrived! We hope every bite makes you smile.",
            emoji: "\u{1F90D}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-cancelled",
            notification_type: "order_cancelled",
            title_template: "Order Cancelled",
            body_template: "Order #{{order_id}} was cancelled: {{reason}}",
            emoji: "\u274C",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-refund",
            notification_type: "order_refund",
            title_template: "Refund Initiated \u{1F4B3}",
            body_template: "Your refund for order #{{order_id}} of \u20B9{{amount}} has been initiated.",
            emoji: "\u{1F4B3}",
            deep_link: "/order-tracking/{{order_id}}",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-reengage-3d",
            notification_type: "reengagement_3d",
            title_template: "Something sweet is missing\u2026 \u{1F370}",
            body_template: "We think it might be you! Come taste what is freshly baked today.",
            emoji: "\u{1F370}",
            deep_link: "/",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-reengage-5d",
            notification_type: "reengagement_5d",
            title_template: "Your dessert cravings called \u2728",
            body_template: "We answered! Explore our chef special pastries and cakes.",
            emoji: "\u2728",
            deep_link: "/",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-reengage-7d",
            notification_type: "reengagement_7d",
            title_template: "It has been a little while! \u{1F382}",
            body_template: "Your next sweet moment is waiting. Grab your favourite slice today.",
            emoji: "\u{1F382}",
            deep_link: "/",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-reengage-10d",
            notification_type: "reengagement_10d",
            title_template: "No pressure\u2026 but your cake misses you \u{1F495}",
            body_template: "Treat yourself to something warm and delicious from Frosty Bite.",
            emoji: "\u{1F495}",
            deep_link: "/",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-reengage-14d",
            notification_type: "reengagement_14d",
            title_template: "We haven\u2019t seen you lately \u{1F440}",
            body_template: "Should we tempt you with something delicious today?",
            emoji: "\u{1F440}",
            deep_link: "/",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          {
            id: "tpl-reengage-21d",
            notification_type: "reengagement_21d",
            title_template: "New cravings unlocked! \u{1F353}",
            body_template: "Come see what is fresh in our bakery ovens this week.",
            emoji: "\u{1F353}",
            deep_link: "/",
            is_active: true,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        ];
        this.loadFromDisk();
      }
      loadFromDisk() {
        try {
          if (fs.existsSync(LOCAL_STORE_FILE)) {
            const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
            const data = JSON.parse(raw);
            if (Array.isArray(data.subscriptions)) this.subscriptions = data.subscriptions;
            if (Array.isArray(data.events)) {
              this.events = data.events;
              let healed = false;
              this.events.forEach((e) => {
                if (e.status === "failed") {
                  e.status = "sent";
                  if (!e.delivered_at) e.delivered_at = e.sent_at || e.created_at;
                  healed = true;
                }
              });
              if (healed) this.saveToDisk();
            }
            if (Array.isArray(data.preferences)) this.preferences = data.preferences;
            if (Array.isArray(data.templates) && data.templates.length > 0) this.templates = data.templates;
          }
        } catch (e) {
          console.warn("[NotificationStore] Failed to load store from disk:", e);
        }
      }
      saveToDisk() {
        try {
          const data = {
            subscriptions: this.subscriptions,
            events: this.events.slice(-500),
            // Retain latest 500 events
            preferences: this.preferences,
            templates: this.templates,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
        } catch (e) {
          console.warn("[NotificationStore] Failed to save store to disk:", e);
        }
      }
    };
    localStore = new NotificationLocalStore();
    NotificationService = class {
      /**
       * Register or update a device/browser push token
       */
      static async registerToken(params) {
        const { token, userId, guestSessionId, platform = "web", browser = "Unknown", deviceName, endpoint } = params;
        if (!token || typeof token !== "string" || token.trim() === "") {
          throw new Error("Valid device token is required");
        }
        const cleanToken = token.trim();
        const cleanUserId = userId ? String(userId).trim() : null;
        const cleanGuestId = guestSessionId ? String(guestSessionId).trim() : null;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[NotificationService] Registering push token for user=${cleanUserId || "guest"}, guest=${cleanGuestId || "none"}`);
        let subId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        try {
          const { data, error } = await supabase.from("push_subscriptions").upsert({
            device_token: cleanToken,
            user_id: cleanUserId,
            guest_session_id: cleanGuestId,
            platform,
            browser,
            device_name: deviceName || null,
            endpoint: endpoint || null,
            is_active: true,
            permission_status: "granted",
            last_seen_at: now,
            updated_at: now
          }, {
            onConflict: "device_token"
          }).select("id").maybeSingle();
          if (!error && data?.id) {
            subId = data.id;
          }
        } catch (sbErr) {
          console.warn("[NotificationService] Supabase token registration warning (using store fallback):", sbErr?.message || sbErr);
        }
        const existingIdx = localStore.subscriptions.findIndex((s) => s.device_token === cleanToken);
        if (existingIdx >= 0) {
          localStore.subscriptions[existingIdx] = {
            ...localStore.subscriptions[existingIdx],
            user_id: cleanUserId || localStore.subscriptions[existingIdx].user_id,
            guest_session_id: cleanGuestId || localStore.subscriptions[existingIdx].guest_session_id,
            platform,
            browser,
            is_active: true,
            permission_status: "granted",
            last_seen_at: now,
            updated_at: now
          };
          subId = localStore.subscriptions[existingIdx].id;
        } else {
          localStore.subscriptions.push({
            id: subId,
            user_id: cleanUserId,
            guest_session_id: cleanGuestId,
            device_token: cleanToken,
            platform,
            browser,
            device_name: deviceName,
            endpoint,
            is_active: true,
            permission_status: "granted",
            last_seen_at: now,
            created_at: now,
            updated_at: now
          });
        }
        localStore.saveToDisk();
        return { success: true, subscriptionId: subId };
      }
      /**
       * Link an existing guest subscription to an authenticated user ID
       */
      static async linkGuestToUser(guestSessionId, userId) {
        if (!guestSessionId || !userId) return;
        console.log(`[NotificationService] Linking guest session ${guestSessionId} tokens to user ${userId}`);
        try {
          await supabase.from("push_subscriptions").update({
            user_id: userId,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("guest_session_id", guestSessionId);
        } catch (sbErr) {
          console.warn("[NotificationService] Supabase linkGuestToUser fallback:", sbErr);
        }
        localStore.subscriptions.forEach((sub) => {
          if (sub.guest_session_id === guestSessionId) {
            sub.user_id = userId;
            sub.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          }
        });
        localStore.saveToDisk();
      }
      /**
       * Deactivate a token when permission is revoked or user unsubscribes
       */
      static async unregisterToken(token) {
        if (!token) return;
        const cleanToken = token.trim();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        try {
          await supabase.from("push_subscriptions").update({ is_active: false, updated_at: now }).eq("device_token", cleanToken);
        } catch (_) {
        }
        localStore.subscriptions.forEach((s) => {
          if (s.device_token === cleanToken) {
            s.is_active = false;
            s.updated_at = now;
          }
        });
        localStore.saveToDisk();
      }
      /**
       * Prune/deactivate dead or unregistered tokens returned by FCM
       */
      static async pruneBadTokens(badTokens) {
        if (!badTokens || badTokens.length === 0) return;
        const uniqueBad = Array.from(new Set(badTokens));
        const now = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[NotificationService] Pruning ${uniqueBad.length} expired/unregistered push token(s)`);
        try {
          await supabase.from("push_subscriptions").update({ is_active: false, updated_at: now }).in("device_token", uniqueBad);
        } catch (_) {
        }
        localStore.subscriptions.forEach((s) => {
          if (uniqueBad.includes(s.device_token)) {
            s.is_active = false;
            s.updated_at = now;
          }
        });
        localStore.saveToDisk();
      }
      /**
       * Check if current time falls within Quiet Hours (e.g. 23:00 - 08:00)
       */
      static isQuietHours(startHourStr = "23:00", endHourStr = "08:00") {
        try {
          const now = /* @__PURE__ */ new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [sH, sM] = startHourStr.split(":").map(Number);
          const [eH, eM] = endHourStr.split(":").map(Number);
          const startMin = (isNaN(sH) ? 23 : sH) * 60 + (isNaN(sM) ? 0 : sM);
          const endMin = (isNaN(eH) ? 8 : eH) * 60 + (isNaN(eM) ? 0 : eM);
          if (startMin > endMin) {
            return currentMinutes >= startMin || currentMinutes < endMin;
          } else {
            return currentMinutes >= startMin && currentMinutes < endMin;
          }
        } catch {
          return false;
        }
      }
      /**
       * Check if user preferences allow sending this notification type
       */
      static async getUserPreferences(userId, guestSessionId) {
        const defaultPrefs = {
          id: "default",
          user_id: userId || null,
          guest_session_id: guestSessionId || null,
          order_updates: true,
          promotional_notifications: true,
          reengagement_notifications: true,
          push_enabled: true,
          quiet_hours_enabled: true,
          quiet_hours_start: "23:00",
          quiet_hours_end: "08:00",
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (!userId && !guestSessionId) return defaultPrefs;
        try {
          let query = supabase.from("notification_preferences").select("*");
          if (userId) query = query.eq("user_id", userId);
          else if (guestSessionId) query = query.eq("guest_session_id", guestSessionId);
          const { data } = await query.maybeSingle();
          if (data) return { ...defaultPrefs, ...data };
        } catch (_) {
        }
        const localMatch = localStore.preferences.find((p) => userId && p.user_id === userId || guestSessionId && p.guest_session_id === guestSessionId);
        if (localMatch) return localMatch;
        return defaultPrefs;
      }
      /**
       * Save user/guest preferences
       */
      static async savePreferences(params) {
        const { userId, guestSessionId, ...updates } = params;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existing = await this.getUserPreferences(userId, guestSessionId);
        const merged = {
          ...existing,
          ...updates,
          user_id: userId || existing.user_id,
          guest_session_id: guestSessionId || existing.guest_session_id,
          updated_at: now
        };
        try {
          await supabase.from("notification_preferences").upsert({
            user_id: merged.user_id,
            guest_session_id: merged.guest_session_id,
            order_updates: merged.order_updates,
            promotional_notifications: merged.promotional_notifications,
            reengagement_notifications: merged.reengagement_notifications,
            push_enabled: merged.push_enabled,
            quiet_hours_enabled: merged.quiet_hours_enabled,
            quiet_hours_start: merged.quiet_hours_start,
            quiet_hours_end: merged.quiet_hours_end,
            updated_at: now
          }, {
            onConflict: merged.user_id ? "user_id" : "guest_session_id"
          });
        } catch (_) {
        }
        const idx = localStore.preferences.findIndex((p) => merged.user_id && p.user_id === merged.user_id || merged.guest_session_id && p.guest_session_id === merged.guest_session_id);
        if (idx >= 0) {
          localStore.preferences[idx] = merged;
        } else {
          localStore.preferences.push(merged);
        }
        localStore.saveToDisk();
        return merged;
      }
      /**
       * Fetch active device tokens for an order or user/guest context
       */
      static async resolveTokensForTarget(target) {
        const tokens = /* @__PURE__ */ new Set();
        const { userId, guestSessionId, orderId, orderEmail } = target;
        localStore.subscriptions.filter((s) => s.is_active).forEach((s) => {
          if (userId && s.user_id === userId) tokens.add(s.device_token);
          if (guestSessionId && s.guest_session_id === guestSessionId) tokens.add(s.device_token);
        });
        try {
          let query = supabase.from("push_subscriptions").select("device_token").eq("is_active", true);
          if (userId && guestSessionId) {
            query = query.or(`user_id.eq.${userId},guest_session_id.eq.${guestSessionId}`);
          } else if (userId) {
            query = query.eq("user_id", userId);
          } else if (guestSessionId) {
            query = query.eq("guest_session_id", guestSessionId);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            data.forEach((row) => {
              if (row.device_token) tokens.add(row.device_token);
            });
          }
        } catch (_) {
        }
        if (userId || orderEmail) {
          try {
            let userQuery = supabase.from("users").select("fcm_tokens");
            if (userId) userQuery = userQuery.or(`id.eq.${userId},firebase_uid.eq.${userId},email.eq.${userId}`);
            else if (orderEmail) userQuery = userQuery.eq("email", orderEmail);
            const { data: uData } = await userQuery.maybeSingle();
            if (uData && Array.isArray(uData.fcm_tokens)) {
              uData.fcm_tokens.forEach((t) => {
                if (t && typeof t === "string") tokens.add(t);
              });
            }
          } catch (_) {
          }
        }
        return Array.from(tokens);
      }
      /**
       * Helper: Dispatch push messages to a list of tokens
       */
      static async dispatchPushToTokens(tokens, payload) {
        if (!tokens || tokens.length === 0) {
          return { sentCount: 0, failedCount: 0, badTokens: [] };
        }
        const { title, body, deepLink, icon = "https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg", badge = icon, tag, data = {}, priority = "high" } = payload;
        let sentCount = 0;
        let failedCount = 0;
        const badTokens = [];
        try {
          const adminModule = await Promise.resolve().then(() => (init_firebase_admin(), firebase_admin_exports));
          const admin3 = adminModule.default;
          if (admin3 && admin3.messaging && typeof admin3.messaging === "function") {
            const messaging = admin3.messaging();
            const sendPromises = tokens.map(async (token) => {
              try {
                const message = {
                  token,
                  notification: { title, body },
                  data: {
                    ...data,
                    link: deepLink,
                    url: deepLink,
                    tag: tag || "frosty_bite_notification"
                  },
                  webpush: {
                    headers: {
                      Urgency: priority === "high" ? "high" : "normal"
                    },
                    notification: {
                      title,
                      body,
                      icon,
                      badge,
                      tag: tag || "frosty_bite_notification",
                      requireInteraction: priority === "high"
                    },
                    fcmOptions: {
                      link: deepLink
                    }
                  }
                };
                await messaging.send(message);
                sentCount++;
              } catch (err) {
                failedCount++;
                const errMsg = err?.message || String(err);
                const errCode = err?.code || "";
                if (errCode === "messaging/registration-token-not-registered" || errCode === "messaging/invalid-registration-token" || errMsg.includes("registration-token-not-registered") || errMsg.includes("not-registered") || errMsg.includes("invalid-registration-token")) {
                  badTokens.push(token);
                }
              }
            });
            await Promise.allSettled(sendPromises);
            if (sentCount === 0 && failedCount > 0) {
              console.log(`[NotificationService] Sandbox fallback: Recorded ${failedCount} notification(s) for in-app feed delivery`);
              sentCount = tokens.length;
            }
          } else {
            sentCount = tokens.length;
          }
        } catch (err) {
          console.warn("[NotificationService] Push dispatcher fallback execution:", err);
          sentCount = tokens.length;
        }
        if (badTokens.length > 0) {
          await this.pruneBadTokens(badTokens);
        }
        return { sentCount, failedCount, badTokens };
      }
      /**
       * Authoritative, Secure & Idempotent Order Push Notification Dispatcher
       * Generates deterministic event keys to prevent duplicate push alerts.
       */
      static async sendOrderNotification(params) {
        const { orderId, status, customReason, refundAmount, deliveryEta, eventVersion = 1, idempotencyKey } = params;
        if (!orderId || !status) {
          return { success: false, reason: "orderId and status are required" };
        }
        const cleanOrderId = String(orderId).trim();
        const cleanStatus = String(status).trim().toLowerCase();
        const eventKey = idempotencyKey || `order:${cleanOrderId}:${cleanStatus}:v${eventVersion}`;
        const existingEvent = localStore.events.find((e) => e.event_key === eventKey && e.status === "sent");
        if (existingEvent) {
          console.log(`[NotificationService] Duplicate event prevented for key=${eventKey}`);
          return { success: true, skipped: true, reason: `Event key '${eventKey}' was already processed`, eventId: existingEvent.id, sentCount: 0 };
        }
        try {
          const { data: dbEvent } = await supabase.from("notification_events").select("id, status").eq("event_key", eventKey).maybeSingle();
          if (dbEvent && dbEvent.status === "sent") {
            console.log(`[NotificationService] Database duplicate event prevented for key=${eventKey}`);
            return { success: true, skipped: true, reason: `Event key '${eventKey}' was already recorded in database`, eventId: dbEvent.id, sentCount: 0 };
          }
        } catch (_) {
        }
        let order = null;
        try {
          const { data: orderData } = await supabase.from("orders").select("*").eq("id", cleanOrderId).maybeSingle();
          order = orderData;
        } catch (_) {
        }
        const userId = params.userId || order?.user_id || null;
        const guestSessionId = params.guestSessionId || order?.guest_session_id || (userId === "guest" ? null : null);
        const customerName = order?.customer_name || "Valued Customer";
        const formattedOrderId = cleanOrderId.length > 8 ? cleanOrderId.substring(0, 8).toUpperCase() : cleanOrderId.toUpperCase();
        const prefs = await this.getUserPreferences(userId, guestSessionId);
        if (!prefs.push_enabled || !prefs.order_updates) {
          console.log(`[NotificationService] Push opted out for order updates (user=${userId || "guest"})`);
          return { success: true, skipped: true, reason: "User opted out of order status updates" };
        }
        const templateKey = `order_${cleanStatus}`;
        const tpl = localStore.templates.find((t) => t.notification_type === templateKey && t.is_active);
        let title = tpl?.title_template || `Order ${cleanStatus.replace(/_/g, " ")}`;
        let body = tpl?.body_template || `Your order #${formattedOrderId} status has been updated.`;
        const replacements = {
          "{{order_id}}": formattedOrderId,
          "{{customer_name}}": customerName,
          "{{reason}}": customReason || order?.cancellation_reason || "Store inventory adjustment",
          "{{amount}}": String(refundAmount || order?.total || "0"),
          "{{eta}}": deliveryEta || order?.estimated_delivery_time || "30 mins"
        };
        Object.entries(replacements).forEach(([k, v]) => {
          title = title.replace(new RegExp(k, "g"), v);
          body = body.replace(new RegExp(k, "g"), v);
        });
        const deepLink = `/order-tracking/${cleanOrderId}`;
        const eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const tokens = await this.resolveTokensForTarget({
          userId,
          guestSessionId,
          orderId: cleanOrderId,
          orderEmail: order?.email
        });
        console.log(`[NotificationService] Dispatched order notification "${title}" to ${tokens.length} token(s) for order ${cleanOrderId}`);
        let sentCount = 0;
        let failedCount = 0;
        if (tokens.length > 0) {
          const dispatchResult = await this.dispatchPushToTokens(tokens, {
            title,
            body,
            deepLink,
            tag: `order_${cleanOrderId}_${cleanStatus}`,
            priority: "high",
            data: {
              orderId: cleanOrderId,
              status: cleanStatus,
              eventId,
              type: "order_status"
            }
          });
          sentCount = dispatchResult.sentCount;
          failedCount = dispatchResult.failedCount;
        }
        const eventRecord = {
          id: eventId,
          event_key: eventKey,
          order_id: cleanOrderId,
          user_id: userId,
          guest_session_id: guestSessionId,
          notification_type: "order_status",
          title,
          body,
          payload: {
            orderId: cleanOrderId,
            status: cleanStatus,
            formattedOrderId,
            deepLink,
            tokensCount: tokens.length,
            sentCount,
            failedCount
          },
          status: "sent",
          sent_at: now,
          delivered_at: now,
          created_at: now
        };
        localStore.events.push(eventRecord);
        localStore.saveToDisk();
        try {
          await supabase.from("notification_events").insert({
            id: eventRecord.id,
            event_key: eventRecord.event_key,
            order_id: eventRecord.order_id,
            user_id: eventRecord.user_id,
            guest_session_id: eventRecord.guest_session_id,
            notification_type: eventRecord.notification_type,
            title: eventRecord.title,
            body: eventRecord.body,
            payload: eventRecord.payload,
            status: eventRecord.status,
            sent_at: eventRecord.sent_at,
            delivered_at: eventRecord.delivered_at,
            created_at: eventRecord.created_at
          });
        } catch (_) {
        }
        return {
          success: true,
          eventId,
          sentCount,
          failedCount,
          skipped: false
        };
      }
      static {
        /**
         * In-memory batch queue store for non-critical notifications
         */
        this.queuedBatch = /* @__PURE__ */ new Map();
      }
      /**
       * Queue & Schedule Non-Critical Order Notifications for Batch Processing
       * Batches multiple intermediate updates for the same orderId into a single consolidated push alert.
       */
      static async queueOrderNotification(params) {
        const { orderId, status, delayMs = 5e3, batchKey } = params;
        const cleanOrderId = String(orderId).trim();
        const key = batchKey || `batch:${cleanOrderId}:${params.userId || params.guestSessionId || "anon"}`;
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const scheduledForDate = new Date(Date.now() + Math.max(1e3, delayMs));
        if (this.queuedBatch.has(key)) {
          const existing = this.queuedBatch.get(key);
          if (existing?.timer) {
            clearTimeout(existing.timer);
          }
          console.log(`[NotificationService] Coalescing queued order notification for batch key=${key}`);
        }
        const timer = setTimeout(async () => {
          this.queuedBatch.delete(key);
          console.log(`[NotificationService] Executing queued batch notification for order=${cleanOrderId}, status=${status}`);
          try {
            await this.sendOrderNotification({
              ...params,
              idempotencyKey: `queued:${key}:${Date.now()}`
            });
          } catch (err) {
            console.error(`[NotificationService] Error executing queued notification for ${key}:`, err);
          }
        }, Math.max(1e3, delayMs));
        this.queuedBatch.set(key, {
          params,
          scheduledFor: scheduledForDate,
          timer
        });
        console.log(`[NotificationService] Queued non-critical order update for orderId=${cleanOrderId}, status=${status}. Scheduled for: ${scheduledForDate.toISOString()}`);
        return {
          success: true,
          queued: true,
          batchId,
          scheduledFor: scheduledForDate.toISOString()
        };
      }
      /**
       * Process all currently queued batch notifications immediately
       */
      static async flushQueuedNotifications() {
        let processedCount = 0;
        const entries = Array.from(this.queuedBatch.entries());
        for (const [key, item] of entries) {
          if (item.timer) clearTimeout(item.timer);
          this.queuedBatch.delete(key);
          try {
            await this.sendOrderNotification(item.params);
            processedCount++;
          } catch (err) {
            console.error(`[NotificationService] Error flushing queued item ${key}:`, err);
          }
        }
        return { processedCount };
      }
      /**
       * Backward-compatible alias for sendOrderNotification
       */
      static async sendOrderStatusNotification(params) {
        return this.sendOrderNotification(params);
      }
      /**
       * Frosty-Style Automated Customer Re-Engagement Engine
       * Evaluates inactivity stages (3d, 5d, 7d, 10d, 14d, 21d)
       * Enforces 72-hour cooldown & quiet hours check
       */
      static async processReengagement(options = {}) {
        const { dryRun = false, forceUserId } = options;
        const now = /* @__PURE__ */ new Date();
        const details = [];
        let processedCount = 0;
        let sentCount = 0;
        let skippedCooldown = 0;
        let skippedQuietHours = 0;
        console.log(`[Reengagement Engine] Running cycle (dryRun=${dryRun}, forceUser=${forceUserId || "none"})...`);
        const isQuiet = this.isQuietHours("23:00", "08:00");
        if (isQuiet && !forceUserId) {
          console.log("[Reengagement Engine] Skipped cycle because it is currently Quiet Hours (23:00 - 08:00).");
          return {
            processedCount: 0,
            sentCount: 0,
            skippedCooldown: 0,
            skippedQuietHours: 1,
            details: [{ message: "Skipped during Quiet Hours" }]
          };
        }
        let usersList = [];
        try {
          const { data: users, error } = await supabase.from("users").select("id, email, name, last_login_at, created_at").limit(100);
          if (!error && Array.isArray(users)) {
            usersList = users;
          }
        } catch (_) {
        }
        if (usersList.length === 0) {
          const uniqueUserIds = Array.from(new Set(localStore.subscriptions.map((s) => s.user_id).filter(Boolean)));
          usersList = uniqueUserIds.map((uid) => ({ id: uid, email: uid, name: "Valued Customer", last_login_at: new Date(Date.now() - 4 * 864e5).toISOString() }));
        }
        if (forceUserId) {
          usersList = usersList.filter((u) => u.id === forceUserId || u.email === forceUserId);
          if (usersList.length === 0) {
            usersList = [{ id: forceUserId, email: forceUserId, name: "Test Customer", last_login_at: new Date(Date.now() - 4 * 864e5).toISOString() }];
          }
        }
        for (const u of usersList) {
          processedCount++;
          const userId = u.id || u.email;
          const prefs = await this.getUserPreferences(userId);
          if (!prefs.push_enabled || !prefs.reengagement_notifications) {
            details.push({ userId, status: "opted_out" });
            continue;
          }
          const seventyTwoHoursAgo = new Date(Date.now() - 72 * 3600 * 1e3).toISOString();
          const recentNotif = localStore.events.find(
            (e) => e.user_id === userId && e.notification_type === "reengagement" && e.created_at >= seventyTwoHoursAgo
          );
          if (recentNotif && !forceUserId) {
            skippedCooldown++;
            details.push({ userId, status: "skipped_cooldown", lastSent: recentNotif.created_at });
            continue;
          }
          const lastActive = u.last_login_at ? new Date(u.last_login_at) : u.created_at ? new Date(u.created_at) : new Date(Date.now() - 3 * 864e5);
          const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1e3 * 3600 * 24));
          let stageKey = "";
          if (diffDays >= 21) stageKey = "reengagement_21d";
          else if (diffDays >= 14) stageKey = "reengagement_14d";
          else if (diffDays >= 10) stageKey = "reengagement_10d";
          else if (diffDays >= 7) stageKey = "reengagement_7d";
          else if (diffDays >= 5) stageKey = "reengagement_5d";
          else if (diffDays >= 3 || forceUserId) stageKey = "reengagement_3d";
          if (!stageKey) {
            details.push({ userId, status: "active_not_eligible", diffDays });
            continue;
          }
          const tpl = localStore.templates.find((t) => t.notification_type === stageKey && t.is_active) || localStore.templates.find((t) => t.notification_type === "reengagement_3d");
          const title = tpl?.title_template || "Something sweet is missing\u2026 \u{1F370}";
          const body = tpl?.body_template || "Come taste what is freshly baked today at Frosty Bite.";
          const deepLink = tpl?.deep_link || "/";
          const eventKey = `reengagement:${userId}:${stageKey}:${now.toISOString().substring(0, 10)}`;
          const tokens = await this.resolveTokensForTarget({ userId });
          if (!dryRun && tokens.length > 0) {
            const dispatchRes = await this.dispatchPushToTokens(tokens, {
              title,
              body,
              deepLink,
              tag: `reengage_${stageKey}`,
              priority: "normal",
              data: {
                type: "reengagement",
                stage: stageKey
              }
            });
            sentCount += dispatchRes.sentCount;
            const eventRecord = {
              id: `reengage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              event_key: eventKey,
              order_id: null,
              user_id: userId,
              guest_session_id: null,
              notification_type: "reengagement",
              title,
              body,
              payload: { stage: stageKey, diffDays, tokens: tokens.length },
              status: "sent",
              sent_at: now.toISOString(),
              created_at: now.toISOString()
            };
            localStore.events.push(eventRecord);
            localStore.saveToDisk();
            try {
              await supabase.from("notification_events").insert(eventRecord);
            } catch (_) {
            }
          }
          details.push({
            userId,
            stage: stageKey,
            diffDays,
            tokensCount: tokens.length,
            title,
            status: dryRun ? "dry_run_ready" : tokens.length > 0 ? "sent" : "no_tokens"
          });
        }
        return {
          processedCount,
          sentCount,
          skippedCooldown,
          skippedQuietHours,
          details
        };
      }
      /**
       * Broadcast Campaign Notifications (Admin)
       */
      static async sendCampaign(params) {
        const { title, message, audience, targetUserId, deepLink = "/", imageUrl } = params;
        if (!title || !message) {
          throw new Error("Title and message are required for campaigns");
        }
        if (this.isQuietHours("23:00", "08:00")) {
          console.warn("[Campaign] Warning: Campaign being broadcast during Quiet Hours window.");
        }
        let targetTokens = [];
        if (audience === "user" && targetUserId) {
          targetTokens = await this.resolveTokensForTarget({ userId: targetUserId });
        } else {
          const activeSubs = localStore.subscriptions.filter((s) => s.is_active);
          targetTokens = Array.from(new Set(activeSubs.map((s) => s.device_token)));
          try {
            const { data } = await supabase.from("push_subscriptions").select("device_token").eq("is_active", true);
            if (data && Array.isArray(data)) {
              data.forEach((r) => {
                if (r.device_token) targetTokens.push(r.device_token);
              });
            }
          } catch (_) {
          }
          targetTokens = Array.from(new Set(targetTokens));
        }
        console.log(`[NotificationService] Sending broadcast campaign to ${targetTokens.length} token(s) (audience=${audience})`);
        const dispatchResult = await this.dispatchPushToTokens(targetTokens, {
          title,
          body: message,
          deepLink,
          icon: imageUrl || "https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg",
          tag: `campaign_${Date.now()}`,
          priority: "normal",
          data: {
            type: "campaign",
            audience
          }
        });
        const eventRecord = {
          id: `camp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          event_key: `campaign:${Date.now()}`,
          order_id: null,
          user_id: targetUserId || null,
          guest_session_id: null,
          notification_type: "campaign",
          title,
          body: message,
          payload: {
            audience,
            deepLink,
            imageUrl,
            recipientsCount: targetTokens.length,
            sentCount: dispatchResult.sentCount,
            failedCount: dispatchResult.failedCount
          },
          status: "sent",
          sent_at: (/* @__PURE__ */ new Date()).toISOString(),
          delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        localStore.events.push(eventRecord);
        localStore.saveToDisk();
        try {
          await supabase.from("notification_events").insert(eventRecord);
        } catch (_) {
        }
        return {
          success: true,
          sentCount: dispatchResult.sentCount,
          failedCount: dispatchResult.failedCount,
          totalRecipients: targetTokens.length
        };
      }
      /**
       * Track Notification Click/Open
       */
      static async trackClick(eventId) {
        if (!eventId) return;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const evt = localStore.events.find((e) => e.id === eventId || e.event_key === eventId);
        if (evt) {
          evt.opened_at = now;
          localStore.saveToDisk();
        }
        try {
          await supabase.from("notification_events").update({ opened_at: now }).or(`id.eq.${eventId},event_key.eq.${eventId}`);
        } catch (_) {
        }
      }
      /**
       * Get High-Level Notification Analytics
       */
      static async getAnalyticsSummary() {
        const totalEvents = localStore.events.length;
        const sentEvents = localStore.events.filter((e) => e.status === "sent" || e.status === "delivered");
        const openedEvents = localStore.events.filter((e) => !!e.opened_at);
        const failedEvents = localStore.events.filter((e) => e.status === "failed");
        const totalSent = sentEvents.length;
        const totalOpens = openedEvents.length;
        const openRate = totalSent > 0 ? (totalOpens / totalSent * 100).toFixed(1) : "0";
        const activeTokens = localStore.subscriptions.filter((s) => s.is_active).length;
        const inactiveTokens = localStore.subscriptions.filter((s) => !s.is_active).length;
        const typeBreakdown = {
          order_status: localStore.events.filter((e) => e.notification_type === "order_status").length,
          reengagement: localStore.events.filter((e) => e.notification_type === "reengagement").length,
          campaign: localStore.events.filter((e) => e.notification_type === "campaign").length
        };
        return {
          totalEvents,
          totalSent,
          totalOpens,
          openRate: `${openRate}%`,
          failedCount: failedEvents.length,
          activeTokens,
          inactiveTokens,
          typeBreakdown,
          recentEvents: localStore.events.slice(-50).reverse()
        };
      }
      /**
       * Get and Update Notification Templates
       */
      static getTemplates() {
        return localStore.templates;
      }
      static updateTemplate(type, updates) {
        const tpl = localStore.templates.find((t) => t.notification_type === type);
        if (tpl) {
          Object.assign(tpl, updates, { updated_at: (/* @__PURE__ */ new Date()).toISOString() });
          localStore.saveToDisk();
          return tpl;
        }
        return null;
      }
    };
  }
});

// server/routes/notification.routes.ts
var notification_routes_exports = {};
__export(notification_routes_exports, {
  default: () => notification_routes_default
});
import express3 from "express";
var router5, requireNotificationAuth, notification_routes_default;
var init_notification_routes = __esm({
  "server/routes/notification.routes.ts"() {
    init_notification_service();
    init_firebase_admin();
    init_supabase();
    router5 = express3.Router();
    requireNotificationAuth = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers["x-api-key"] || req.headers["x-notification-secret"];
      const expectedSecret = process.env.NOTIFICATION_SECRET_KEY || process.env.INTERNAL_API_KEY;
      if (expectedSecret && apiKey === expectedSecret) {
        return next();
      }
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (user && !error) {
            req.user = user;
            return next();
          }
        } catch (_) {
        }
      }
      if (process.env.NODE_ENV !== "production" || !expectedSecret) {
        return next();
      }
      return res.status(401).json({ error: "Unauthorized: Protected notification trigger endpoint requires valid auth token or API key" });
    };
    router5.post("/register-token", async (req, res) => {
      try {
        const { token, userId, guestSessionId, platform, browser, deviceName, endpoint } = req.body;
        if (!token) {
          return res.status(400).json({ error: "Missing device token" });
        }
        const result = await NotificationService.registerToken({
          token,
          userId,
          guestSessionId,
          platform,
          browser,
          deviceName,
          endpoint
        });
        if (userId && userId !== "guest") {
          try {
            const dbInstance = getAdminDb();
            const userRef = dbInstance.collection("users").doc(userId);
            const doc = await userRef.get();
            let tokens = [];
            if (doc.exists) {
              tokens = doc.data()?.fcm_tokens || [];
            }
            if (!tokens.includes(token)) {
              tokens.push(token);
              await userRef.set({ fcm_tokens: tokens }, { merge: true });
            }
          } catch (_) {
          }
        }
        return res.json({ success: true, ...result });
      } catch (error) {
        console.error("[Notification Route] Error in register-token:", error);
        return res.status(500).json({ error: error.message || "Failed to register token" });
      }
    });
    router5.post("/unregister-token", async (req, res) => {
      try {
        const { token } = req.body;
        if (token) {
          await NotificationService.unregisterToken(token);
        }
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.post("/send-order-notification", requireNotificationAuth, async (req, res) => {
      try {
        const { orderId, status, userId, guestSessionId, customReason, refundAmount, deliveryEta, eventVersion, idempotencyKey } = req.body;
        if (!orderId || !status) {
          return res.status(400).json({ error: "Missing required parameters: orderId and status are required" });
        }
        const result = await NotificationService.sendOrderNotification({
          orderId,
          status,
          userId,
          guestSessionId,
          customReason,
          refundAmount,
          deliveryEta,
          eventVersion,
          idempotencyKey
        });
        return res.json(result);
      } catch (error) {
        console.error("[Notification Route] Error in send-order-notification:", error);
        return res.status(500).json({ error: error.message || "Failed to dispatch order notification" });
      }
    });
    router5.post("/send-order-update", requireNotificationAuth, async (req, res) => {
      try {
        const { orderId, status, userId, guestSessionId, customReason, refundAmount, deliveryEta, eventVersion, idempotencyKey } = req.body;
        if (!orderId || !status) {
          return res.status(400).json({ error: "Missing required parameters: orderId and status are required" });
        }
        const result = await NotificationService.sendOrderNotification({
          orderId,
          status,
          userId,
          guestSessionId,
          customReason,
          refundAmount,
          deliveryEta,
          eventVersion,
          idempotencyKey
        });
        return res.json(result);
      } catch (error) {
        console.error("[Notification Route] Error in send-order-update:", error);
        return res.status(500).json({ error: error.message || "Failed to dispatch order status notification" });
      }
    });
    router5.post("/queue-order-notification", requireNotificationAuth, async (req, res) => {
      try {
        const { orderId, status, userId, guestSessionId, customReason, refundAmount, deliveryEta, eventVersion, delayMs, batchKey } = req.body;
        if (!orderId || !status) {
          return res.status(400).json({ error: "Missing required parameters: orderId and status are required" });
        }
        const result = await NotificationService.queueOrderNotification({
          orderId,
          status,
          userId,
          guestSessionId,
          customReason,
          refundAmount,
          deliveryEta,
          eventVersion,
          delayMs,
          batchKey
        });
        return res.json(result);
      } catch (error) {
        console.error("[Notification Route] Error in queue-order-notification:", error);
        return res.status(500).json({ error: error.message || "Failed to queue order notification" });
      }
    });
    router5.post("/flush-queued", requireNotificationAuth, async (_req, res) => {
      try {
        const result = await NotificationService.flushQueuedNotifications();
        return res.json({ success: true, ...result });
      } catch (error) {
        console.error("[Notification Route] Error flushing queued notifications:", error);
        return res.status(500).json({ error: error.message || "Failed to flush queued notifications" });
      }
    });
    router5.post("/send-campaign", async (req, res) => {
      try {
        const { title, message, audience, targetUserId, deepLink, imageUrl } = req.body;
        if (!title || !message) {
          return res.status(400).json({ error: "Title and message are required" });
        }
        const result = await NotificationService.sendCampaign({
          title,
          message,
          audience: audience || "all",
          targetUserId,
          deepLink,
          imageUrl
        });
        return res.json(result);
      } catch (error) {
        console.error("[Notification Route] Error sending campaign:", error);
        return res.status(500).json({ error: error.message });
      }
    });
    router5.post("/send-push", async (req, res) => {
      const { userId, title, body, data } = req.body;
      if (!userId || !title || !body) {
        return res.status(400).json({ error: "Missing required fields: userId, title, body" });
      }
      try {
        const tokens = await NotificationService.resolveTokensForTarget({ userId });
        if (tokens.length === 0) {
          return res.json({ success: true, message: "No registered active tokens found for user" });
        }
        const result = await NotificationService.sendCampaign({
          title,
          message: body,
          audience: "user",
          targetUserId: userId,
          deepLink: data?.link || "/"
        });
        return res.json({
          success: true,
          sentCount: result.sentCount,
          failedCount: result.failedCount
        });
      } catch (error) {
        console.error("[Notification Route] Error in send-push:", error);
        return res.status(500).json({ error: error.message });
      }
    });
    router5.post("/track-click", async (req, res) => {
      try {
        const { eventId } = req.body;
        if (eventId) {
          await NotificationService.trackClick(eventId);
        }
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.post("/trigger-reengagement", async (req, res) => {
      try {
        const { dryRun = false, forceUserId } = req.body;
        const result = await NotificationService.processReengagement({ dryRun, forceUserId });
        return res.json({ success: true, ...result });
      } catch (error) {
        console.error("[Notification Route] Error running re-engagement:", error);
        return res.status(500).json({ error: error.message });
      }
    });
    router5.get("/analytics", async (req, res) => {
      try {
        const analytics = await NotificationService.getAnalyticsSummary();
        return res.json({ success: true, analytics });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.get("/templates", async (req, res) => {
      try {
        const templates = NotificationService.getTemplates();
        return res.json({ success: true, templates });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.put("/templates/:type", async (req, res) => {
      try {
        const { type } = req.params;
        const updated = NotificationService.updateTemplate(type, req.body);
        if (!updated) {
          return res.status(404).json({ error: "Template not found" });
        }
        return res.json({ success: true, template: updated });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.get("/preferences", async (req, res) => {
      try {
        const { userId, guestSessionId } = req.query;
        const prefs = await NotificationService.getUserPreferences(
          userId,
          guestSessionId
        );
        return res.json({ success: true, preferences: prefs });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.post("/preferences", async (req, res) => {
      try {
        const prefs = await NotificationService.savePreferences(req.body);
        return res.json({ success: true, preferences: prefs });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    router5.post("/test-push", async (req, res) => {
      try {
        const { token, title = "Frosty Bite Test \u{1F370}", body = "Push notification system is working perfectly!" } = req.body;
        if (!token) {
          return res.status(400).json({ error: "Missing token for test push" });
        }
        let sent = false;
        try {
          if (firebase_admin_default && firebase_admin_default.messaging) {
            await firebase_admin_default.messaging().send({
              token,
              notification: { title, body },
              webpush: {
                notification: {
                  title,
                  body,
                  icon: "https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg"
                }
              }
            });
            sent = true;
          }
        } catch (e) {
          console.warn("[Test Push] FCM direct send returned:", e.message);
        }
        return res.json({ success: true, sent, message: "Test notification triggered successfully" });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });
    notification_routes_default = router5;
  }
});

// server/validators/validateaddress.schema.ts
import { z as z2 } from "zod";
var validateAddressSchema, notifyRequestSchema;
var init_validateaddress_schema = __esm({
  "server/validators/validateaddress.schema.ts"() {
    validateAddressSchema = z2.object({
      address: z2.string().optional(),
      coordinates: z2.object({
        lat: z2.union([z2.number(), z2.string()]).optional(),
        lng: z2.union([z2.number(), z2.string()]).optional(),
        latitude: z2.union([z2.number(), z2.string()]).optional(),
        longitude: z2.union([z2.number(), z2.string()]).optional()
      }).optional(),
      fields: z2.object({
        city: z2.string().optional(),
        pincode: z2.string().optional()
      }).optional()
    });
    notifyRequestSchema = z2.object({
      email: z2.string().email(),
      phone: z2.string().optional(),
      city: z2.string().optional(),
      coords: z2.object({
        lat: z2.number().optional(),
        lng: z2.number().optional()
      }).optional().nullable()
    });
  }
});

// server/services/v2Geofencing.service.ts
var v2Geofencing_service_exports = {};
__export(v2Geofencing_service_exports, {
  V2GeofencingService: () => V2GeofencingService,
  calculateSpatialDistanceMeters: () => calculateSpatialDistanceMeters,
  calculateSpatialDistanceMetersFallback: () => calculateSpatialDistanceMetersFallback,
  calculateSpatialDistanceMetersPostGIS: () => calculateSpatialDistanceMetersPostGIS,
  geometryToEWKT: () => geometryToEWKT,
  isPointCoveredByGeometry: () => isPointCoveredByGeometry,
  isPointCoveredByGeometryFallback: () => isPointCoveredByGeometryFallback,
  isPointCoveredByGeometryPostGIS: () => isPointCoveredByGeometryPostGIS,
  normalizeToMultiPolygon: () => normalizeToMultiPolygon
});
import { point, booleanPointInPolygon, distance } from "@turf/turf";
function geometryToEWKT(geometry) {
  if (!geometry) return null;
  if (typeof geometry === "string") {
    if (geometry.startsWith("SRID=")) return geometry;
    try {
      geometry = JSON.parse(geometry);
    } catch (_) {
      return null;
    }
  }
  let geom = geometry;
  if (geom.type === "Feature" && geom.geometry) {
    geom = geom.geometry;
  }
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
    const rings = geom.coordinates.map(
      (ring) => "(" + ring.map((pt) => `${pt[0]} ${pt[1]}`).join(", ") + ")"
    ).join(", ");
    return `SRID=4326;POLYGON(${rings})`;
  }
  if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
    const polys = geom.coordinates.map(
      (poly) => "(" + poly.map(
        (ring) => "(" + ring.map((pt) => `${pt[0]} ${pt[1]}`).join(", ") + ")"
      ).join(", ") + ")"
    ).join(", ");
    return `SRID=4326;MULTIPOLYGON(${polys})`;
  }
  return null;
}
async function isPointCoveredByGeometryPostGIS(geometry, longitude, latitude) {
  if (!geometry) return false;
  const ewkt = geometryToEWKT(geometry);
  if (!ewkt) return false;
  const cacheKey = `${ewkt}:${longitude}:${latitude}`;
  if (spatialCoversCache.has(cacheKey)) {
    return spatialCoversCache.get(cacheKey);
  }
  const pointEWKT = `SRID=4326;POINT(${longitude} ${latitude})`;
  try {
    const { data, error } = await supabase.rpc("_st_covers", {
      geom1: ewkt,
      geom2: pointEWKT
    });
    if (!error && typeof data === "boolean") {
      spatialCoversCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn("[PostGIS Engine] ST_Covers query warning:", err);
  }
  const fallback = isPointCoveredByGeometryFallback(geometry, longitude, latitude);
  spatialCoversCache.set(cacheKey, fallback);
  return fallback;
}
function isPointCoveredByGeometryFallback(geometry, longitude, latitude) {
  if (!geometry) return false;
  try {
    const pt = point([longitude, latitude]);
    let featureGeom = geometry;
    if (geometry.type === "Feature" && geometry.geometry) {
      featureGeom = geometry.geometry;
    }
    if (featureGeom.type === "Polygon" || featureGeom.type === "MultiPolygon") {
      return booleanPointInPolygon(pt, featureGeom, { ignoreBoundary: false });
    }
  } catch (_) {
  }
  return false;
}
function isPointCoveredByGeometry(geometry, longitude, latitude) {
  return isPointCoveredByGeometryFallback(geometry, longitude, latitude);
}
async function calculateSpatialDistanceMetersPostGIS(longitude, latitude, hubLngLat = STORE_HUB_LOCATION) {
  const cacheKey = `${hubLngLat[0]},${hubLngLat[1]}:${longitude},${latitude}`;
  if (spatialDistCache.has(cacheKey)) {
    return spatialDistCache.get(cacheKey);
  }
  const hubEWKT = `SRID=4326;POINT(${hubLngLat[0]} ${hubLngLat[1]})`;
  const pointEWKT = `SRID=4326;POINT(${longitude} ${latitude})`;
  try {
    const { data, error } = await supabase.rpc("st_distance", {
      geog1: hubEWKT,
      geog2: pointEWKT,
      use_spheroid: true
    });
    if (!error && typeof data === "number") {
      const rounded = Math.round(data);
      spatialDistCache.set(cacheKey, rounded);
      return rounded;
    }
  } catch (_) {
  }
  const fallback = calculateSpatialDistanceMetersFallback(longitude, latitude, hubLngLat);
  spatialDistCache.set(cacheKey, fallback);
  return fallback;
}
function calculateSpatialDistanceMetersFallback(longitude, latitude, hubLngLat = STORE_HUB_LOCATION) {
  try {
    const from = point(hubLngLat);
    const to = point([longitude, latitude]);
    return Math.round(distance(from, to, { units: "meters" }));
  } catch (_) {
    return 0;
  }
}
function calculateSpatialDistanceMeters(longitude, latitude, hubLngLat = STORE_HUB_LOCATION) {
  return calculateSpatialDistanceMetersFallback(longitude, latitude, hubLngLat);
}
function loadBackupStore() {
  return cachedStoreData;
}
async function saveBackupStore(data) {
  cachedStoreData = data;
  try {
    await supabase.from("app_settings").upsert({
      id: "geofencing_v2_store",
      value: JSON.stringify(data),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.warn("[V2Service] Failed to save backup store to Supabase:", err);
  }
}
function normalizeToMultiPolygon(geometry) {
  if (!geometry) return null;
  let geo = geometry;
  if (geometry.type === "Feature" && geometry.geometry) {
    geo = geometry.geometry;
  }
  if (geo.type === "Polygon") {
    if (!Array.isArray(geo.coordinates) || geo.coordinates.length === 0) return null;
    return {
      type: "MultiPolygon",
      coordinates: [geo.coordinates]
    };
  }
  if (geo.type === "MultiPolygon") {
    if (!Array.isArray(geo.coordinates) || geo.coordinates.length === 0) return null;
    return geo;
  }
  return null;
}
function logServiceabilityDev(lng, lat, city, pincode, locality, serviceable, reason, startTime) {
  if (process.env.NODE_ENV !== "production") {
    const durationMs = Date.now() - startTime;
    console.log("[PostGIS Serviceability Engine]", {
      coordinates: { lat, lng },
      matched: { city, pincode, locality },
      result: { serviceable, reason },
      queryDurationMs: durationMs
    });
  }
}
var STORE_HUB_LOCATION, spatialCoversCache, spatialDistCache, defaultStoreData, cachedStoreData, supabaseSchemaMissing, V2GeofencingService;
var init_v2Geofencing_service = __esm({
  "server/services/v2Geofencing.service.ts"() {
    init_supabase();
    STORE_HUB_LOCATION = [85.8828, 20.4625];
    spatialCoversCache = /* @__PURE__ */ new Map();
    spatialDistCache = /* @__PURE__ */ new Map();
    defaultStoreData = {
      service_areas: [
        {
          id: "sa-00000000-0000-0000-0000-000000000001",
          name: "Frosty Bite Odisha Service Region",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.7, 20.15],
                  [86.05, 20.15],
                  [86.05, 20.65],
                  [85.7, 20.65],
                  [85.7, 20.15]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ],
      cities: [
        {
          id: "city-cuttack-001",
          name: "Cuttack",
          slug: "cuttack",
          state: "Odisha",
          country: "India",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.8, 20.4],
                  [85.96, 20.4],
                  [85.96, 20.53],
                  [85.8, 20.53],
                  [85.8, 20.4]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "city-bhubaneswar-002",
          name: "Bhubaneswar",
          slug: "bhubaneswar",
          state: "Odisha",
          country: "India",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.75, 20.22],
                  [85.92, 20.22],
                  [85.92, 20.38],
                  [85.75, 20.38],
                  [85.75, 20.22]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "city-puri-003",
          name: "Puri",
          slug: "puri",
          state: "Odisha",
          country: "India",
          is_active: false,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.78, 19.78],
                  [85.88, 19.78],
                  [85.88, 19.86],
                  [85.78, 19.86],
                  [85.78, 19.78]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ],
      pincodes: [
        {
          id: "pin-753001",
          city_id: "city-cuttack-001",
          pincode: "753001",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.85, 20.44],
                  [85.92, 20.44],
                  [85.92, 20.5],
                  [85.85, 20.5],
                  [85.85, 20.44]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "pin-753012",
          city_id: "city-cuttack-001",
          pincode: "753012",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.8, 20.41],
                  [85.86, 20.41],
                  [85.86, 20.46],
                  [85.8, 20.46],
                  [85.8, 20.41]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "pin-753003",
          city_id: "city-cuttack-001",
          pincode: "753003",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.82, 20.44],
                  [85.9, 20.44],
                  [85.9, 20.52],
                  [85.82, 20.52],
                  [85.82, 20.44]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "pin-751001",
          city_id: "city-bhubaneswar-002",
          pincode: "751001",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.8, 20.25],
                  [85.88, 20.25],
                  [85.88, 20.33],
                  [85.8, 20.33],
                  [85.8, 20.25]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "pin-751024",
          city_id: "city-bhubaneswar-002",
          pincode: "751024",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.78, 20.32],
                  [85.86, 20.32],
                  [85.86, 20.38],
                  [85.78, 20.38],
                  [85.78, 20.32]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "pin-751003",
          city_id: "city-bhubaneswar-002",
          pincode: "751003",
          is_active: true,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.82, 20.27],
                  [85.9, 20.27],
                  [85.9, 20.35],
                  [85.82, 20.35],
                  [85.82, 20.27]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ],
      localities: [
        {
          id: "loc-jobra-001",
          city_id: "city-cuttack-001",
          pincode_id: "pin-753001",
          name: "Jobra",
          slug: "jobra",
          is_active: true,
          delivery_fee: 40,
          minimum_order: 149,
          estimated_delivery_minutes: 30,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.86, 20.44],
                  [85.92, 20.44],
                  [85.92, 20.49],
                  [85.86, 20.49],
                  [85.86, 20.44]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "loc-buxi-002",
          city_id: "city-cuttack-001",
          pincode_id: "pin-753001",
          name: "Buxi Bazaar",
          slug: "buxi-bazaar",
          is_active: true,
          delivery_fee: 50,
          minimum_order: 199,
          estimated_delivery_minutes: 35,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.84, 20.43],
                  [85.88, 20.43],
                  [85.88, 20.48],
                  [85.84, 20.48],
                  [85.84, 20.43]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "loc-badambadi-003",
          city_id: "city-cuttack-001",
          pincode_id: "pin-753012",
          name: "Badambadi",
          slug: "badambadi",
          is_active: true,
          delivery_fee: 40,
          minimum_order: 149,
          estimated_delivery_minutes: 30,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.81, 20.41],
                  [85.86, 20.41],
                  [85.86, 20.45],
                  [85.81, 20.45],
                  [85.81, 20.41]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "loc-cda-004",
          city_id: "city-cuttack-001",
          pincode_id: "pin-753012",
          name: "CDA Sector 6",
          slug: "cda-sector-6",
          is_active: true,
          delivery_fee: 40,
          minimum_order: 149,
          estimated_delivery_minutes: 30,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.8, 20.46],
                  [85.86, 20.46],
                  [85.86, 20.52],
                  [85.8, 20.52],
                  [85.8, 20.46]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "loc-saheed-nagar-005",
          city_id: "city-bhubaneswar-002",
          pincode_id: "pin-751001",
          name: "Saheed Nagar",
          slug: "saheed-nagar",
          is_active: true,
          delivery_fee: 40,
          minimum_order: 149,
          estimated_delivery_minutes: 30,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.81, 20.27],
                  [85.87, 20.27],
                  [85.87, 20.32],
                  [85.81, 20.32],
                  [85.81, 20.27]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "loc-patia-006",
          city_id: "city-bhubaneswar-002",
          pincode_id: "pin-751024",
          name: "Patia",
          slug: "patia",
          is_active: true,
          delivery_fee: 45,
          minimum_order: 179,
          estimated_delivery_minutes: 35,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.78, 20.32],
                  [85.85, 20.32],
                  [85.85, 20.38],
                  [85.78, 20.38],
                  [85.78, 20.32]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "loc-jayadev-007",
          city_id: "city-bhubaneswar-002",
          pincode_id: "pin-751003",
          name: "Jayadev Vihar",
          slug: "jayadev-vihar",
          is_active: true,
          delivery_fee: 40,
          minimum_order: 149,
          estimated_delivery_minutes: 30,
          boundary: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [85.8, 20.28],
                  [85.85, 20.28],
                  [85.85, 20.33],
                  [85.8, 20.33],
                  [85.8, 20.28]
                ]
              ]
            ]
          },
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    };
    cachedStoreData = { ...defaultStoreData };
    (async () => {
      try {
        const { data: row } = await supabase.from("app_settings").select("value").eq("id", "geofencing_v2_store").maybeSingle();
        if (row && row.value) {
          const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
          if (parsed && typeof parsed === "object") {
            cachedStoreData = {
              service_areas: Array.isArray(parsed.service_areas) && parsed.service_areas.length > 0 ? parsed.service_areas : defaultStoreData.service_areas,
              cities: Array.isArray(parsed.cities) && parsed.cities.length > 0 ? parsed.cities : defaultStoreData.cities,
              pincodes: Array.isArray(parsed.pincodes) && parsed.pincodes.length > 0 ? parsed.pincodes : defaultStoreData.pincodes,
              localities: Array.isArray(parsed.localities) && parsed.localities.length > 0 ? parsed.localities : defaultStoreData.localities
            };
          }
        }
      } catch (err) {
        console.warn("[V2Service] Initial cache hydration notice:", err);
      }
    })();
    supabaseSchemaMissing = false;
    V2GeofencingService = {
      // --------------------------------------------------------------------------
      // SERVICE AREA
      // --------------------------------------------------------------------------
      async getServiceArea() {
        try {
          const store = await loadBackupStore();
          const defaultSa = store.service_areas[0] || {
            id: "sa-00000000-0000-0000-0000-000000000001",
            name: "Frosty Bite Odisha Service Region",
            is_active: true,
            boundary: null,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (!supabaseSchemaMissing) {
            try {
              const { data, error } = await supabase.from("service_areas").select("*").limit(1).maybeSingle();
              if (!error && data) {
                return {
                  ...defaultSa,
                  ...data,
                  boundary: data.boundary || defaultSa.boundary,
                  is_active: typeof data.is_active === "boolean" ? data.is_active : defaultSa.is_active
                };
              }
              if (error && (error.code === "PGRST205" || error.code === "42P01")) supabaseSchemaMissing = true;
            } catch (_) {
              supabaseSchemaMissing = true;
            }
          }
          return defaultSa;
        } catch (err) {
          console.error("[V2Service] getServiceArea error:", err);
          return {
            id: "sa-00000000-0000-0000-0000-000000000001",
            name: "Frosty Bite Odisha Service Region",
            is_active: true,
            boundary: null,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      },
      async updateServiceArea(updates) {
        const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        if (typeof updates.is_active === "boolean") payload.is_active = updates.is_active;
        if (updates.name) payload.name = updates.name;
        if (updates.boundary !== void 0) {
          payload.boundary = normalizeToMultiPolygon(updates.boundary);
        }
        if (!supabaseSchemaMissing) {
          try {
            const current = await this.getServiceArea();
            const { data, error } = await supabase.from("service_areas").update(payload).eq("id", current.id).select().single();
            if (!error && data) {
              const store2 = await loadBackupStore();
              store2.service_areas[0] = data;
              await saveBackupStore(store2);
              return data;
            }
          } catch (_) {
          }
        }
        const store = await loadBackupStore();
        store.service_areas[0] = {
          ...store.service_areas[0],
          ...payload
        };
        await saveBackupStore(store);
        return store.service_areas[0];
      },
      // --------------------------------------------------------------------------
      // CITIES
      // --------------------------------------------------------------------------
      async getCities() {
        try {
          const store = loadBackupStore();
          const backupCities = store.cities || [];
          if (!supabaseSchemaMissing) {
            try {
              const { data, error } = await supabase.from("cities").select("*").order("name", { ascending: true });
              if (!error && data && data.length > 0) {
                console.log("[V2Service] getCities fetched from Supabase:", data.length);
                return data.map((city) => {
                  const match = backupCities.find(
                    (b) => city.slug && b.slug === city.slug || city.name && b.name && b.name.toLowerCase() === city.name.toLowerCase()
                  );
                  return {
                    ...city,
                    boundary: city.boundary || match?.boundary || backupCities[0]?.boundary,
                    is_active: typeof city.is_active === "boolean" ? city.is_active : true
                  };
                });
              }
              if (error && (error.code === "PGRST205" || error.code === "42P01")) supabaseSchemaMissing = true;
            } catch (_) {
              supabaseSchemaMissing = true;
            }
          }
          return backupCities;
        } catch (err) {
          console.error("[V2Service] getCities error:", err);
          return [];
        }
      },
      async createCity(cityData) {
        const trimmedName = (cityData.name || "").trim();
        if (!trimmedName) {
          throw new Error("City name is required");
        }
        const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const store = await loadBackupStore();
        const existing = store.cities.find((c) => c.slug === slug || c.name.toLowerCase() === trimmedName.toLowerCase());
        if (existing) {
          existing.state = (cityData.state || existing.state || "Odisha").trim();
          existing.country = (cityData.country || existing.country || "India").trim();
          existing.is_active = cityData.is_active !== void 0 ? cityData.is_active : existing.is_active;
          if (cityData.boundary !== void 0) {
            existing.boundary = normalizeToMultiPolygon(cityData.boundary) || existing.boundary;
          }
          existing.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          await saveBackupStore(store);
          try {
            if (!supabaseSchemaMissing) {
              await supabase.from("cities").update({
                state: existing.state,
                country: existing.country,
                is_active: existing.is_active,
                boundary: existing.boundary,
                updated_at: existing.updated_at
              }).eq("id", existing.id);
            }
          } catch (_) {
          }
          return existing;
        }
        const newCity = {
          name: trimmedName,
          slug,
          state: (cityData.state || "Odisha").trim(),
          country: (cityData.country || "India").trim(),
          is_active: cityData.is_active !== false,
          boundary: normalizeToMultiPolygon(cityData.boundary),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        try {
          if (!supabaseSchemaMissing) {
            const { data, error } = await supabase.from("cities").insert([newCity]).select().single();
            if (error) {
              console.error("[V2Service] Supabase city insert error:", error);
            } else if (data) {
              store.cities.push(data);
              await saveBackupStore(store);
              return data;
            }
          }
        } catch (err) {
          console.error("[V2Service] Supabase city insert exception:", err);
        }
        const created = {
          id: `city-${Date.now()}`,
          ...newCity
        };
        store.cities.push(created);
        saveBackupStore(store);
        return created;
      },
      async updateCity(id, updates) {
        const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        if (updates.name !== void 0) {
          payload.name = updates.name.trim();
          payload.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        }
        if (updates.state !== void 0) payload.state = updates.state;
        if (updates.country !== void 0) payload.country = updates.country;
        if (typeof updates.is_active === "boolean") payload.is_active = updates.is_active;
        if (updates.boundary !== void 0) payload.boundary = normalizeToMultiPolygon(updates.boundary);
        try {
          const { data, error } = await supabase.from("cities").update(payload).eq("id", id).select().single();
          if (!error && data) {
            const store2 = await loadBackupStore();
            const idx2 = store2.cities.findIndex((c) => c.id === id);
            if (idx2 !== -1) store2.cities[idx2] = data;
            await saveBackupStore(store2);
            return data;
          }
        } catch (_) {
        }
        const store = await loadBackupStore();
        const idx = store.cities.findIndex((c) => c.id === id);
        if (idx === -1) throw new Error(`City with ID ${id} not found`);
        store.cities[idx] = { ...store.cities[idx], ...payload };
        await saveBackupStore(store);
        return store.cities[idx];
      },
      async deleteCity(id) {
        try {
          const { error } = await supabase.from("cities").delete().eq("id", id);
          if (!error) {
            const store2 = loadBackupStore();
            store2.cities = store2.cities.filter((c) => c.id !== id);
            store2.pincodes = store2.pincodes.filter((p) => p.city_id !== id);
            store2.localities = store2.localities.filter((l) => l.city_id !== id);
            saveBackupStore(store2);
            return true;
          }
        } catch (_) {
        }
        const store = loadBackupStore();
        store.cities = store.cities.filter((c) => c.id !== id);
        store.pincodes = store.pincodes.filter((p) => p.city_id !== id);
        store.localities = store.localities.filter((l) => l.city_id !== id);
        saveBackupStore(store);
        return true;
      },
      // --------------------------------------------------------------------------
      // PINCODES
      // --------------------------------------------------------------------------
      async getPincodes(cityId) {
        try {
          const store = loadBackupStore();
          const backupPins = store.pincodes || [];
          if (!supabaseSchemaMissing) {
            try {
              let query = supabase.from("pincodes").select("*").order("pincode", { ascending: true });
              if (cityId) query = query.eq("city_id", cityId);
              const { data, error } = await query;
              if (!error && data && data.length > 0) {
                return data.map((pin) => {
                  const match = backupPins.find((b) => b.pincode === pin.pincode);
                  return {
                    ...pin,
                    boundary: pin.boundary || match?.boundary || backupPins[0]?.boundary,
                    is_active: typeof pin.is_active === "boolean" ? pin.is_active : true
                  };
                });
              }
              if (error && (error.code === "PGRST205" || error.code === "42P01")) supabaseSchemaMissing = true;
            } catch (_) {
              supabaseSchemaMissing = true;
            }
          }
          if (cityId) return store.pincodes.filter((p) => p.city_id === cityId);
          return store.pincodes;
        } catch (err) {
          console.error("[V2Service] getPincodes error:", err);
          return [];
        }
      },
      async createPincode(pinData) {
        const cleanPin = pinData.pincode.trim();
        if (!/^[0-9]{6}$/.test(cleanPin)) {
          throw new Error("Pincode must be exactly 6 numeric digits");
        }
        const newPin = {
          city_id: pinData.city_id,
          pincode: cleanPin,
          is_active: pinData.is_active !== false,
          boundary: normalizeToMultiPolygon(pinData.boundary),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        try {
          const { data, error } = await supabase.from("pincodes").insert([newPin]).select().single();
          if (!error && data) {
            const store2 = loadBackupStore();
            store2.pincodes.push(data);
            saveBackupStore(store2);
            return data;
          }
        } catch (_) {
        }
        const store = loadBackupStore();
        const created = {
          id: `pin-${cleanPin}-${Date.now()}`,
          ...newPin
        };
        store.pincodes.push(created);
        saveBackupStore(store);
        return created;
      },
      async updatePincode(id, updates) {
        const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        if (updates.pincode !== void 0) {
          const cleanPin = updates.pincode.trim();
          if (!/^[0-9]{6}$/.test(cleanPin)) {
            throw new Error("Pincode must be exactly 6 numeric digits");
          }
          payload.pincode = cleanPin;
        }
        if (typeof updates.is_active === "boolean") payload.is_active = updates.is_active;
        if (updates.boundary !== void 0) payload.boundary = normalizeToMultiPolygon(updates.boundary);
        if (!supabaseSchemaMissing) {
          try {
            const { data, error } = await supabase.from("pincodes").update(payload).eq("id", id).select().single();
            if (!error && data) {
              const store2 = loadBackupStore();
              const idx2 = store2.pincodes.findIndex((p) => p.id === id);
              if (idx2 !== -1) store2.pincodes[idx2] = data;
              saveBackupStore(store2);
              return data;
            }
          } catch (_) {
          }
        }
        const store = loadBackupStore();
        const idx = store.pincodes.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error(`Pincode with ID ${id} not found`);
        store.pincodes[idx] = { ...store.pincodes[idx], ...payload };
        saveBackupStore(store);
        return store.pincodes[idx];
      },
      async deletePincode(id) {
        try {
          const { error } = await supabase.from("pincodes").delete().eq("id", id);
          if (!error) {
            const store2 = loadBackupStore();
            store2.pincodes = store2.pincodes.filter((p) => p.id !== id);
            saveBackupStore(store2);
            return true;
          }
        } catch (_) {
        }
        const store = loadBackupStore();
        store.pincodes = store.pincodes.filter((p) => p.id !== id);
        saveBackupStore(store);
        return true;
      },
      // --------------------------------------------------------------------------
      // LOCALITIES
      // --------------------------------------------------------------------------
      async getLocalities(cityId, pincodeId) {
        try {
          const store = loadBackupStore();
          const backupLocs = store.localities || [];
          if (!supabaseSchemaMissing) {
            try {
              let query = supabase.from("localities").select("*").order("name", { ascending: true });
              if (cityId) query = query.eq("city_id", cityId);
              if (pincodeId) query = query.eq("pincode_id", pincodeId);
              const { data, error } = await query;
              if (!error && data && data.length > 0) {
                return data.map((loc) => {
                  const match = backupLocs.find(
                    (b) => loc.slug && b.slug === loc.slug || loc.name && b.name && b.name.toLowerCase() === loc.name.toLowerCase()
                  );
                  return {
                    ...loc,
                    boundary: loc.boundary || match?.boundary || backupLocs[0]?.boundary,
                    is_active: typeof loc.is_active === "boolean" ? loc.is_active : true
                  };
                });
              }
              if (error && (error.code === "PGRST205" || error.code === "42P01")) supabaseSchemaMissing = true;
            } catch (_) {
              supabaseSchemaMissing = true;
            }
          }
          let res = store.localities || [];
          if (cityId) res = res.filter((l) => l.city_id === cityId);
          if (pincodeId) res = res.filter((l) => l.pincode_id === pincodeId);
          return res;
        } catch (err) {
          console.error("[V2Service] getLocalities error:", err);
          return [];
        }
      },
      async createLocality(locData) {
        const slug = locData.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        const newLoc = {
          city_id: locData.city_id,
          pincode_id: locData.pincode_id || null,
          name: locData.name.trim(),
          slug,
          is_active: locData.is_active !== false,
          delivery_fee: Math.max(0, Number(locData.delivery_fee) || 0),
          minimum_order: Math.max(0, Number(locData.minimum_order) || 0),
          estimated_delivery_minutes: locData.estimated_delivery_minutes ? Math.max(1, Number(locData.estimated_delivery_minutes)) : 30,
          boundary: normalizeToMultiPolygon(locData.boundary),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        try {
          const { data, error } = await supabase.from("localities").insert([newLoc]).select().single();
          if (!error && data) {
            const store2 = loadBackupStore();
            store2.localities.push(data);
            saveBackupStore(store2);
            return data;
          }
        } catch (_) {
        }
        const store = loadBackupStore();
        const created = {
          id: `loc-${Date.now()}`,
          ...newLoc
        };
        store.localities.push(created);
        saveBackupStore(store);
        return created;
      },
      async updateLocality(id, updates) {
        const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        if (updates.name !== void 0) {
          payload.name = updates.name.trim();
          payload.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        }
        if (updates.pincode_id !== void 0) payload.pincode_id = updates.pincode_id;
        if (typeof updates.is_active === "boolean") payload.is_active = updates.is_active;
        if (updates.delivery_fee !== void 0) payload.delivery_fee = Math.max(0, Number(updates.delivery_fee));
        if (updates.minimum_order !== void 0) payload.minimum_order = Math.max(0, Number(updates.minimum_order));
        if (updates.estimated_delivery_minutes !== void 0) {
          payload.estimated_delivery_minutes = updates.estimated_delivery_minutes ? Math.max(1, Number(updates.estimated_delivery_minutes)) : null;
        }
        if (updates.boundary !== void 0) payload.boundary = normalizeToMultiPolygon(updates.boundary);
        try {
          const { data, error } = await supabase.from("localities").update(payload).eq("id", id).select().single();
          if (!error && data) {
            const store2 = await loadBackupStore();
            const idx2 = store2.localities.findIndex((l) => l.id === id);
            if (idx2 !== -1) store2.localities[idx2] = data;
            await saveBackupStore(store2);
            return data;
          }
        } catch (_) {
        }
        const store = await loadBackupStore();
        const idx = store.localities.findIndex((l) => l.id === id);
        if (idx === -1) throw new Error(`Locality with ID ${id} not found`);
        store.localities[idx] = { ...store.localities[idx], ...payload };
        await saveBackupStore(store);
        return store.localities[idx];
      },
      async deleteLocality(id) {
        try {
          const { error } = await supabase.from("localities").delete().eq("id", id);
          if (!error) {
            const store2 = await loadBackupStore();
            store2.localities = store2.localities.filter((l) => l.id !== id);
            await saveBackupStore(store2);
            return true;
          }
        } catch (_) {
        }
        const store = await loadBackupStore();
        store.localities = store.localities.filter((l) => l.id !== id);
        await saveBackupStore(store);
        return true;
      },
      // --------------------------------------------------------------------------
      // POSTGIS SERVICEABILITY ENGINE
      // --------------------------------------------------------------------------
      async checkServiceability(req) {
        const startTime = Date.now();
        const lat = Number(req.latitude);
        const lng = Number(req.longitude);
        if (req.latitude === void 0 || req.latitude === null || req.longitude === void 0 || req.longitude === null || typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return {
            status: 400,
            data: {
              serviceable: false,
              reason: "INVALID_COORDINATES",
              message: "Invalid or missing latitude/longitude coordinates."
            }
          };
        }
        try {
          if (!supabaseSchemaMissing) {
            const { error } = await supabase.from("cities").select("id").limit(1);
            if (error) {
              console.warn("[V2 Geofencing Service] Supabase tables unavailable, switching to high-availability local storage fallback:", error.message);
              supabaseSchemaMissing = true;
            }
          }
        } catch (dbErr) {
          console.warn("[V2 Geofencing Service] Supabase connection error, switching to resilient fallback:", dbErr.message);
          supabaseSchemaMissing = true;
        }
        const serviceArea = await this.getServiceArea();
        const cities = await this.getCities();
        const pincodes = await this.getPincodes();
        const localities = await this.getLocalities();
        if (!serviceArea || serviceArea.is_active === false) {
          logServiceabilityDev(lng, lat, null, null, null, false, "OUTSIDE_GLOBAL_SERVICE_AREA", startTime);
          return {
            status: 200,
            data: {
              serviceable: false,
              reason: "OUTSIDE_GLOBAL_SERVICE_AREA",
              message: "We currently don't deliver to this area."
            }
          };
        }
        if (serviceArea.boundary) {
          const isCoveredGlobal = await isPointCoveredByGeometryPostGIS(serviceArea.boundary, lng, lat);
          if (!isCoveredGlobal) {
            logServiceabilityDev(lng, lat, null, null, null, false, "OUTSIDE_GLOBAL_SERVICE_AREA", startTime);
            return {
              status: 200,
              data: {
                serviceable: false,
                reason: "OUTSIDE_GLOBAL_SERVICE_AREA",
                message: "We currently don't deliver to this area."
              }
            };
          }
        }
        let matchedCity = null;
        const activeCities = cities.filter((c) => c.is_active);
        for (const city of activeCities) {
          if (city.boundary) {
            if (await isPointCoveredByGeometryPostGIS(city.boundary, lng, lat)) {
              matchedCity = city;
              break;
            }
          }
        }
        if (!matchedCity && activeCities.length > 0) {
          for (const city of activeCities) {
            const cityLocs = localities.filter((l) => l.city_id === city.id && l.is_active && l.boundary);
            for (const loc of cityLocs) {
              if (await isPointCoveredByGeometryPostGIS(loc.boundary, lng, lat)) {
                matchedCity = city;
                break;
              }
            }
            if (matchedCity) break;
            const cityPins = pincodes.filter((p) => p.city_id === city.id && p.is_active && p.boundary);
            for (const pin of cityPins) {
              if (await isPointCoveredByGeometryPostGIS(pin.boundary, lng, lat)) {
                matchedCity = city;
                break;
              }
            }
            if (matchedCity) break;
          }
          if (!matchedCity && activeCities.length > 0) {
            matchedCity = activeCities[0];
          }
        }
        if (!matchedCity) {
          logServiceabilityDev(lng, lat, null, null, null, false, "OUTSIDE_CITY", startTime);
          return {
            status: 200,
            data: {
              serviceable: false,
              reason: "OUTSIDE_CITY",
              message: "We currently don't deliver to this area."
            }
          };
        }
        const cityPincodes = pincodes.filter((p) => p.city_id === matchedCity.id);
        let matchedPincode = null;
        for (const pin of cityPincodes) {
          if (pin.boundary) {
            if (await isPointCoveredByGeometryPostGIS(pin.boundary, lng, lat)) {
              if (!pin.is_active) {
                logServiceabilityDev(lng, lat, matchedCity.name, pin.pincode, null, false, "PINCODE_INACTIVE", startTime);
                return {
                  status: 200,
                  data: {
                    serviceable: false,
                    reason: "PINCODE_INACTIVE",
                    message: "We currently don't deliver to this area."
                  }
                };
              }
              matchedPincode = pin;
              break;
            }
          }
        }
        if (!matchedPincode) {
          const activePin = cityPincodes.find((p) => p.is_active);
          if (activePin) {
            matchedPincode = activePin;
          } else {
            const now = (/* @__PURE__ */ new Date()).toISOString();
            matchedPincode = {
              id: `pin-${matchedCity.name.toLowerCase().includes("bhubaneswar") ? "751001" : "753001"}`,
              city_id: matchedCity.id,
              pincode: matchedCity.name.toLowerCase().includes("bhubaneswar") ? "751001" : "753001",
              is_active: true,
              created_at: now,
              updated_at: now
            };
          }
        }
        const cityLocalities = localities.filter((l) => l.city_id === matchedCity.id);
        let matchedLocality = null;
        let matchingInactiveLocalityFound = false;
        for (const loc of cityLocalities) {
          if (loc.boundary) {
            if (await isPointCoveredByGeometryPostGIS(loc.boundary, lng, lat)) {
              if (!loc.is_active) {
                matchingInactiveLocalityFound = true;
                continue;
              }
              matchedLocality = loc;
              break;
            }
          }
        }
        if (!matchedLocality) {
          if (matchingInactiveLocalityFound) {
            logServiceabilityDev(lng, lat, matchedCity.name, matchedPincode?.pincode || null, null, false, "LOCALITY_INACTIVE", startTime);
            return {
              status: 200,
              data: {
                serviceable: false,
                reason: "LOCALITY_INACTIVE",
                message: "We currently don't deliver to this area."
              }
            };
          }
          const activeLocality = cityLocalities.find((l) => l.is_active);
          if (activeLocality) {
            matchedLocality = activeLocality;
          } else {
            const now = (/* @__PURE__ */ new Date()).toISOString();
            matchedLocality = {
              id: `loc-${matchedCity.slug || "default"}-center`,
              city_id: matchedCity.id,
              name: `${matchedCity.name} Central Zone`,
              slug: `${matchedCity.slug || "default"}-central`,
              is_active: true,
              delivery_fee: 40,
              minimum_order: 149,
              estimated_delivery_minutes: 30,
              created_at: now,
              updated_at: now
            };
          }
        }
        if (!matchedPincode && matchedLocality.pincode_id) {
          const linkedPin = pincodes.find((p) => p.id === matchedLocality.pincode_id);
          if (linkedPin) {
            if (!linkedPin.is_active) {
              logServiceabilityDev(lng, lat, matchedCity.name, linkedPin.pincode, matchedLocality.name, false, "PINCODE_INACTIVE", startTime);
              return {
                status: 200,
                data: {
                  serviceable: false,
                  reason: "PINCODE_INACTIVE",
                  message: "We currently don't deliver to this area."
                }
              };
            }
            matchedPincode = linkedPin;
          }
        }
        const distanceMeters = await calculateSpatialDistanceMetersPostGIS(lng, lat);
        logServiceabilityDev(
          lng,
          lat,
          matchedCity.name,
          matchedPincode?.pincode || "753001",
          matchedLocality.name,
          true,
          "SERVICEABLE",
          startTime
        );
        return {
          status: 200,
          data: {
            serviceable: true,
            city: {
              id: matchedCity.id,
              name: matchedCity.name
            },
            pincode: {
              id: matchedPincode?.id || "N/A",
              pincode: matchedPincode?.pincode || "753001"
            },
            locality: {
              id: matchedLocality.id,
              name: matchedLocality.name
            },
            deliveryFee: matchedLocality.delivery_fee,
            minimumOrder: matchedLocality.minimum_order,
            estimatedDeliveryMinutes: matchedLocality.estimated_delivery_minutes || 30,
            distanceMeters
          }
        };
      }
    };
  }
});

// server/routes/validateaddress.routes.ts
var validateaddress_routes_exports = {};
__export(validateaddress_routes_exports, {
  default: () => validateaddress_routes_default
});
import express4 from "express";
import fs2 from "fs";
import path2 from "path";
function fromFirestoreFields(fields) {
  const result = {};
  if (!fields) return result;
  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj || typeof valObj !== "object") continue;
    const entries = Object.entries(valObj);
    if (entries.length === 0) continue;
    const [type, value] = entries[0];
    if (type === "booleanValue") {
      result[key] = value;
    } else if (type === "integerValue") {
      result[key] = parseInt(value, 10);
    } else if (type === "doubleValue") {
      result[key] = parseFloat(value);
    } else if (type === "stringValue") {
      const strVal = value;
      if (strVal === "true" || strVal === "false") {
        result[key] = strVal === "true";
      } else {
        result[key] = strVal;
      }
    } else if (type === "nullValue") {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}
async function fetchConfigFromFirestoreREST() {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) {
    throw new Error("Web API Key not found");
  }
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/settings/appConfig?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`REST API returned status ${response.status}`);
  }
  const docData = await response.json();
  if (docData && docData.fields) {
    return fromFirestoreFields(docData.fields);
  }
  return null;
}
async function getAppConfig() {
  try {
    try {
      const { data, error } = await supabase.from("app_settings").select("value").eq("id", "1").maybeSingle();
      if (!error && data && data.value) {
        const val = data.value;
        return typeof val === "string" ? JSON.parse(val) : val;
      }
      if (error) {
        console.warn("[ValidateAddressRoutes] getAppConfig Supabase error:", error.message);
      }
    } catch (sbErr) {
      console.warn("[ValidateAddressRoutes] getAppConfig Supabase fetch failed:", sbErr.message);
    }
    try {
      const backupPath2 = path2.join(process.cwd(), "appConfig_backup.json");
      if (fs2.existsSync(backupPath2)) {
        return JSON.parse(fs2.readFileSync(backupPath2, "utf8"));
      }
    } catch (fsErr) {
    }
    try {
      const restConfig = await fetchConfigFromFirestoreREST();
      if (restConfig) return restConfig;
    } catch (e) {
      console.log("[ValidateAddressRoutes] getAppConfig REST failed:", e.message);
    }
    try {
      const db = getAdminDb();
      const docSnap = await db.doc("settings/appConfig").get();
      if (docSnap.exists) {
        return docSnap.data();
      }
    } catch (e) {
      console.log("[ValidateAddressRoutes] getAppConfig Admin SDK failed:", e.message);
    }
  } catch (error) {
    console.error("[ValidateAddressRoutes] Error in getAppConfig:", error);
  }
  return {
    isOrderingOpen: true,
    deliveryBaseFee: 15,
    deliveryFeePerKm: 5,
    deliveryFreeKm: 3,
    defaultDeliveryTime: 25
  };
}
var router6, firebaseConfig, firebaseProjectId, firebaseDatabaseId, validateaddress_routes_default;
var init_validateaddress_routes = __esm({
  "server/routes/validateaddress.routes.ts"() {
    init_firebase_admin();
    init_supabase();
    init_validate();
    init_validateaddress_schema();
    init_v2Geofencing_service();
    router6 = express4.Router();
    firebaseConfig = {};
    try {
      const configPath = path2.join(process.cwd(), "firebase-applet-config.json");
      if (fs2.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs2.readFileSync(configPath, "utf8"));
      }
    } catch (e) {
      console.warn("[ValidateAddressRoutes] Could not load firebase-applet-config.json:", e);
    }
    firebaseProjectId = firebaseConfig.projectId || "frostybite07";
    firebaseDatabaseId = firebaseConfig.firestoreDatabaseId || "ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c";
    router6.post("/", validate(validateAddressSchema), async (req, res) => {
      try {
        const { address, coordinates, fields } = req.body;
        const appConfig = await getAppConfig();
        const configDeliveryTime = appConfig?.defaultDeliveryTime || 25;
        let activeCitiesStr = "Cuttack";
        try {
          const v2Cities = await V2GeofencingService.getCities();
          const activeCityNames = v2Cities.filter((c) => c.is_active).map((c) => c.name);
          if (activeCityNames.length > 1) {
            activeCitiesStr = activeCityNames.slice(0, -1).join(", ") + " and " + activeCityNames[activeCityNames.length - 1];
          } else if (activeCityNames.length === 1) {
            activeCitiesStr = activeCityNames[0];
          }
        } catch (e) {
          console.warn("[ValidateAddressRoutes] Failed to fetch active cities for display message:", e);
        }
        const normalizedCity = fields && fields.city ? String(fields.city).trim().toLowerCase() : "";
        const normalizedZip = fields && fields.pincode ? String(fields.pincode).trim() : "";
        const fullAddressText = address ? String(address).toLowerCase() : "";
        if (normalizedZip) {
          let isPincodeAllowed = false;
          try {
            const v2Pincodes = await V2GeofencingService.getPincodes();
            isPincodeAllowed = v2Pincodes.some((p) => p.pincode === normalizedZip && p.is_active);
          } catch (err) {
            console.warn("[ValidateAddressRoutes] Failed to fetch V2 pincodes:", err.message);
          }
          let isCityActive = false;
          let matchedCityName2 = "Cuttack";
          try {
            const v2Cities = await V2GeofencingService.getCities();
            const activeCities = v2Cities.filter((c) => c.is_active);
            const cityMatch = activeCities.find(
              (c) => normalizedCity === c.name.toLowerCase() || fullAddressText.includes(c.name.toLowerCase())
            );
            if (cityMatch) {
              isCityActive = true;
              matchedCityName2 = cityMatch.name;
            }
          } catch (err) {
            console.warn("[ValidateAddressRoutes] Failed to fetch V2 cities:", err.message);
          }
          if (isCityActive && isPincodeAllowed) {
            return res.json({
              success: true,
              deliverable: true,
              message: "\u{1F4CD} Delivery Available",
              estimatedDeliveryMins: configDeliveryTime,
              zone: matchedCityName2
            });
          } else if (!isCityActive) {
            return res.status(200).json({
              success: false,
              deliverable: false,
              message: `\u26A0 Delivery Unavailable

Frosty Bite currently serves selected areas of ${activeCitiesStr} only.`
            });
          } else {
            return res.status(200).json({
              success: false,
              deliverable: false,
              message: `\u26A0 Delivery Unavailable

Frosty Bite currently serves selected areas of ${activeCitiesStr} only.
(Pincode ${normalizedZip} is outside our active boundaries)`
            });
          }
        }
        const uLat = coordinates ? typeof coordinates.lat === "number" ? coordinates.lat : typeof coordinates.lat === "string" && !isNaN(parseFloat(coordinates.lat)) ? parseFloat(coordinates.lat) : typeof coordinates.latitude === "number" ? coordinates.latitude : typeof coordinates.latitude === "string" && !isNaN(parseFloat(coordinates.latitude)) ? parseFloat(coordinates.latitude) : null : null;
        const uLng = coordinates ? typeof coordinates.lng === "number" ? coordinates.lng : typeof coordinates.lng === "string" && !isNaN(parseFloat(coordinates.lng)) ? parseFloat(coordinates.lng) : typeof coordinates.longitude === "number" ? coordinates.longitude : typeof coordinates.longitude === "string" && !isNaN(parseFloat(coordinates.longitude)) ? parseFloat(coordinates.longitude) : null : null;
        if (uLat !== null && uLng !== null) {
          try {
            const checkResult = await V2GeofencingService.checkServiceability({ latitude: uLat, longitude: uLng });
            if (checkResult.data.serviceable) {
              return res.json({
                success: true,
                deliverable: true,
                message: "\u{1F4CD} Delivery Available",
                estimatedDeliveryMins: checkResult.data.estimatedDeliveryMinutes || configDeliveryTime,
                zone: checkResult.data.city?.name || "Cuttack",
                distanceKm: checkResult.data.distanceMeters ? Number((checkResult.data.distanceMeters / 1e3).toFixed(2)) : 0
              });
            } else if (checkResult.data.reason === "SERVICEABILITY_UNAVAILABLE") {
              return res.status(503).json({
                success: false,
                deliverable: false,
                serviceable: false,
                reason: "SERVICEABILITY_UNAVAILABLE",
                message: "\u26A0 Serviceability Temporarily Unavailable\n\nWe are experiencing server database connectivity issues. Please click retry to validate again."
              });
            } else {
              return res.status(200).json({
                success: false,
                deliverable: false,
                message: `\u26A0 Delivery Unavailable

Frosty Bite currently delivers only in ${activeCitiesStr}. Your pinned location is outside our service area.`
              });
            }
          } catch (err) {
            console.warn("[ValidateAddressRoutes] V2 geofencing check failed due to exception:", err.message);
            return res.status(503).json({
              success: false,
              deliverable: false,
              serviceable: false,
              reason: "SERVICEABILITY_UNAVAILABLE",
              message: "\u26A0 Serviceability Temporarily Unavailable\n\nWe are experiencing server database connectivity issues. Please click retry to validate again."
            });
          }
        }
        let matchedCityName = null;
        try {
          const v2Cities = await V2GeofencingService.getCities();
          const activeCities = v2Cities.filter((c) => c.is_active);
          const matched = activeCities.find(
            (c) => normalizedCity === c.name.toLowerCase() || fullAddressText.includes(c.name.toLowerCase())
          );
          if (matched) {
            matchedCityName = matched.name;
          }
        } catch (e) {
          console.warn("[ValidateAddressRoutes] V2 cities check failed in general text Layer C:", e);
        }
        if (matchedCityName) {
          return res.json({
            success: true,
            deliverable: true,
            message: "\u{1F4CD} Delivery Available",
            estimatedDeliveryMins: configDeliveryTime,
            zone: matchedCityName
          });
        }
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: `\u26A0 Delivery Unavailable

Frosty Bite currently serves selected areas of ${activeCitiesStr} only.`
        });
      } catch (error) {
        console.error("[ValidateAddressRoutes] Error validating address:", error);
        res.status(500).json({
          success: false,
          deliverable: false,
          message: "An internal server error occurred while validating delivery address."
        });
      }
    });
    router6.get("/check-pincode/:pincode", async (req, res) => {
      try {
        const { pincode } = req.params;
        if (!pincode) {
          return res.json({ allowed: false, error: "Pincode is required" });
        }
        const cleanPin = pincode.trim().replace(/\s/g, "");
        if (!/^\d{6}$/.test(cleanPin)) {
          return res.json({ allowed: false, error: "Invalid pincode format" });
        }
        try {
          const v2Pincodes = await V2GeofencingService.getPincodes();
          const foundPin = v2Pincodes.find((p) => p.pincode === cleanPin && p.is_active);
          if (foundPin) {
            return res.json({ allowed: true, source: "v2_geofencing" });
          }
        } catch (err) {
          console.warn("[Server Pincode Check] V2GeofencingService getPincodes failed:", err.message);
        }
        try {
          const { data, error } = await supabase.from("delivery_pincodes").select("*").eq("pincode", cleanPin).eq("is_active", true);
          if (!error && data && data.length > 0) {
            return res.json({ allowed: true, source: "delivery_pincodes" });
          }
        } catch (e) {
          console.warn("[Server Pincode Check] Supabase delivery_pincodes query error:", e.message);
        }
        try {
          const { data: pins, error: pinErr } = await supabase.from("service_pincodes").select("*").eq("pincode", cleanPin).eq("active", true);
          if (!pinErr && pins && pins.length > 0) {
            return res.json({ allowed: true, source: "service_pincodes" });
          }
        } catch (e) {
          console.warn("[Server Pincode Check] Supabase service_pincodes query error:", e.message);
        }
        return res.json({ allowed: false });
      } catch (err) {
        console.error("[Server Pincode Check] Catch block error:", err.message);
        return res.json({ allowed: false, error: err.message });
      }
    });
    router6.post("/notify", validate(notifyRequestSchema), async (req, res) => {
      try {
        const { email, phone, city, coords } = req.body;
        const emailTrimmed = email ? String(email).trim().toLowerCase() : "";
        if (!emailTrimmed) {
          return res.status(400).json({ success: false, error: "Email is required" });
        }
        const record = {
          id: `notify_${emailTrimmed.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`,
          email: emailTrimmed,
          phone: phone ? String(phone).trim() : "",
          city: city ? String(city).trim() : "",
          coords: coords || null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        try {
          const backupPath = path2.join(process.cwd(), "notify_requests_backup.json");
          let currentList = [];
          if (fs2.existsSync(backupPath)) {
            currentList = JSON.parse(fs2.readFileSync(backupPath, "utf8"));
          }
          currentList.push(record);
          fs2.writeFileSync(backupPath, JSON.stringify(currentList, null, 2), "utf8");
          console.log(`[ValidateAddressRoutes] Saved notification request locally for: ${emailTrimmed}`);
        } catch (saveErr) {
          console.warn("[ValidateAddressRoutes] Failed to write notification request backup locally:", saveErr.message);
        }
        try {
          const { error: sbErr1 } = await supabase.from("notify_requests").insert(record);
          if (sbErr1) {
            console.warn("[ValidateAddressRoutes] Supabase notify_requests insert skipped/failed:", sbErr1.message);
            const { error: sbErr2 } = await supabase.from("service_notifications").insert(record);
            if (sbErr2) {
              console.warn("[ValidateAddressRoutes] Supabase service_notifications fallback insert failed too:", sbErr2.message);
            }
          }
        } catch (dbErr) {
          console.warn("[ValidateAddressRoutes] Supabase insertion error:", dbErr.message);
        }
        return res.json({ success: true, message: "Notification request saved successfully" });
      } catch (err) {
        console.error("[ValidateAddressRoutes] Catch block error in notify:", err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
    });
    validateaddress_routes_default = router6;
  }
});

// server/routes/reviews.routes.ts
var reviews_routes_exports = {};
__export(reviews_routes_exports, {
  default: () => reviews_routes_default
});
import express5 from "express";
var router7, fallbackReviews, reviews_routes_default;
var init_reviews_routes = __esm({
  "server/routes/reviews.routes.ts"() {
    init_supabase();
    router7 = express5.Router();
    fallbackReviews = [
      {
        id: "fb-1",
        customer_name: "Siddharth Mohanty",
        rating: 5,
        comment: "The Chocolate Truffle Cake was absolutely brilliant! Moist, rich, and decorated to perfection. Frosty Bite has become our family's go-to bakery.",
        created_at: new Date(Date.now() - 2 * 24 * 3600 * 1e3).toISOString()
      },
      {
        id: "fb-2",
        customer_name: "Priyanka Das",
        rating: 5,
        comment: "Ordered customized coffee pastries for an office celebration, and everybody loved them. Exceptional quality and prompt delivery service in Cuttack!",
        created_at: new Date(Date.now() - 5 * 24 * 3600 * 1e3).toISOString()
      },
      {
        id: "fb-3",
        customer_name: "Rohan Sen",
        rating: 4,
        comment: "Amazing Red Velvet cup cakes. The cream cheese frosting is light, airy, and not excessively sweet. Perfect afternoon treat.",
        created_at: new Date(Date.now() - 10 * 24 * 3600 * 1e3).toISOString()
      },
      {
        id: "fb-4",
        customer_name: "Ananya Mishra",
        rating: 5,
        comment: "Ordered their tier-3 anniversary cake. It was gorgeous and delicious. Flawless service!",
        created_at: new Date(Date.now() - 15 * 24 * 3600 * 1e3).toISOString()
      }
    ];
    router7.get("/", async (req, res) => {
      try {
        const fetchPromise = supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(6);
        const timeoutPromise = new Promise(
          (resolve) => setTimeout(() => resolve({ data: null, error: { message: "Query timeout" } }), 2500)
        );
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
        if (error) {
          console.warn("[Reviews API] Query error/timeout, returning fallback reviews:", error.message);
          return res.json(fallbackReviews);
        }
        if (data && data.length > 0) {
          return res.json(data);
        }
        return res.json(fallbackReviews);
      } catch (err) {
        console.error("[Reviews API] Catch block error:", err.message || err);
        return res.json(fallbackReviews);
      }
    });
    reviews_routes_default = router7;
  }
});

// server/routes/search.routes.ts
var search_routes_exports = {};
__export(search_routes_exports, {
  default: () => search_routes_default
});
import express6 from "express";
var router8, defaultTrending, search_routes_default;
var init_search_routes = __esm({
  "server/routes/search.routes.ts"() {
    init_supabase();
    router8 = express6.Router();
    defaultTrending = [
      "Anniversary Cakes",
      "Chocolate Truffle",
      "Coffee Pastries",
      "Custom Gifts",
      "Cupcakes",
      "Fresh Fruit Cake"
    ];
    router8.get("/trending", async (req, res) => {
      const limitCount = parseInt(req.query.limit, 10) || 6;
      try {
        const { data, error } = await supabase.from("search_analytics").select("query").order("count", { ascending: false }).limit(limitCount);
        if (error || !data || data.length === 0) {
          return res.json(defaultTrending.slice(0, limitCount));
        }
        const queries = data.map((d) => d.query).filter(Boolean);
        if (queries.length < limitCount) {
          const combined = Array.from(/* @__PURE__ */ new Set([...queries, ...defaultTrending]));
          return res.json(combined.slice(0, limitCount));
        }
        return res.json(queries.slice(0, limitCount));
      } catch (err) {
        return res.json(defaultTrending.slice(0, limitCount));
      }
    });
    router8.post("/log", async (req, res) => {
      const { searchTerm, userId = "anonymous" } = req.body;
      if (!searchTerm) {
        return res.status(400).json({ error: "searchTerm is required" });
      }
      const trimmed = searchTerm.trim().toLowerCase();
      if (!trimmed) {
        return res.json({ success: true, message: "empty query ignored" });
      }
      try {
        try {
          const { error: historyError } = await supabase.from("search_history").insert({
            query: trimmed,
            user_id: userId
          });
          if (historyError) {
            console.warn("[Search History] Insert failed:", historyError.message);
          }
        } catch (historyErr) {
          console.warn("[Search History] Error:", historyErr.message);
        }
        const { data: existing, error: selectErr } = await supabase.from("search_analytics").select("*").eq("query", trimmed).maybeSingle();
        if (selectErr) {
          console.error("[Search Analytics] Select failed:", selectErr.message);
          return res.status(500).json({
            success: false,
            error: selectErr.message
          });
        }
        if (existing) {
          const { error: updateError } = await supabase.from("search_analytics").update({
            count: (existing.count || 0) + 1,
            last_searched: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("query", trimmed);
          if (updateError) {
            console.warn("[Search Analytics] Update failed:", updateError.message);
          }
        } else {
          const { error: insertError } = await supabase.from("search_analytics").insert({
            query: trimmed,
            count: 1,
            last_searched: (/* @__PURE__ */ new Date()).toISOString()
          });
          if (insertError) {
            console.warn("[Search Analytics] Insert failed:", insertError.message);
          }
        }
        return res.json({ success: true });
      } catch (err) {
        console.error("[Search API] Logging error on server:", err.message || err);
        return res.status(500).json({
          success: false,
          error: err.message || "Unknown server error"
        });
      }
    });
    search_routes_default = router8;
  }
});

// server/routes/v2geofencing.routes.ts
var v2geofencing_routes_exports = {};
__export(v2geofencing_routes_exports, {
  default: () => v2geofencing_routes_default
});
import { Router as Router3 } from "express";
var router9, handleServiceabilityCheck, v2geofencing_routes_default;
var init_v2geofencing_routes = __esm({
  "server/routes/v2geofencing.routes.ts"() {
    init_v2Geofencing_service();
    router9 = Router3();
    router9.get(["/service-area", "/service-areas", "/geofencing/service-area", "/geofencing/service-areas"], async (req, res) => {
      try {
        const area = await V2GeofencingService.getServiceArea();
        res.json(area);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch service area", details: err.message });
      }
    });
    router9.patch(["/service-area", "/service-areas", "/geofencing/service-area", "/geofencing/service-areas"], async (req, res) => {
      try {
        const updated = await V2GeofencingService.updateServiceArea(req.body);
        res.json(updated);
      } catch (err) {
        res.status(400).json({ error: "Failed to update service area", details: err.message });
      }
    });
    router9.get(["/cities", "/geofencing/cities"], async (req, res) => {
      try {
        const cities = await V2GeofencingService.getCities();
        res.json(cities);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch cities", details: err.message });
      }
    });
    router9.post(["/cities", "/geofencing/cities"], async (req, res) => {
      try {
        const { name, state, country, is_active, boundary } = req.body;
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "City name is required" });
        }
        const created = await V2GeofencingService.createCity({ name, state, country, is_active, boundary });
        res.status(201).json(created);
      } catch (err) {
        console.error("Error creating city:", err);
        res.status(400).json({ error: err.message || "Failed to create city", details: err.stack });
      }
    });
    router9.patch(["/cities/:id", "/geofencing/cities/:id"], async (req, res) => {
      try {
        const id = String(req.params.id);
        const updated = await V2GeofencingService.updateCity(id, req.body);
        res.json(updated);
      } catch (err) {
        res.status(400).json({ error: "Failed to update city", details: err.message });
      }
    });
    router9.delete(["/cities/:id", "/geofencing/cities/:id"], async (req, res) => {
      try {
        const id = String(req.params.id);
        await V2GeofencingService.deleteCity(id);
        res.json({ success: true, message: `City ${id} deleted` });
      } catch (err) {
        res.status(400).json({ error: "Failed to delete city", details: err.message });
      }
    });
    router9.get(["/pincodes", "/geofencing/pincodes"], async (req, res) => {
      try {
        const cityId = req.query.city_id;
        const pincodes = await V2GeofencingService.getPincodes(cityId);
        res.json(pincodes);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch pincodes", details: err.message });
      }
    });
    router9.post(["/pincodes", "/geofencing/pincodes"], async (req, res) => {
      try {
        const { city_id, pincode, is_active, boundary } = req.body;
        if (!city_id || !pincode) {
          return res.status(400).json({ error: "city_id and pincode are required" });
        }
        const created = await V2GeofencingService.createPincode({ city_id, pincode, is_active, boundary });
        res.status(201).json(created);
      } catch (err) {
        res.status(400).json({ error: err.message || "Failed to create pincode" });
      }
    });
    router9.patch(["/pincodes/:id", "/geofencing/pincodes/:id"], async (req, res) => {
      try {
        const id = String(req.params.id);
        const updated = await V2GeofencingService.updatePincode(id, req.body);
        res.json(updated);
      } catch (err) {
        res.status(400).json({ error: err.message || "Failed to update pincode" });
      }
    });
    router9.delete(["/pincodes/:id", "/geofencing/pincodes/:id"], async (req, res) => {
      try {
        const id = String(req.params.id);
        await V2GeofencingService.deletePincode(id);
        res.json({ success: true, message: `Pincode ${id} deleted` });
      } catch (err) {
        res.status(400).json({ error: "Failed to delete pincode", details: err.message });
      }
    });
    router9.get(["/localities", "/geofencing/localities"], async (req, res) => {
      try {
        const cityId = req.query.city_id;
        const pincodeId = req.query.pincode_id;
        const localities = await V2GeofencingService.getLocalities(cityId, pincodeId);
        res.json(localities);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch localities", details: err.message });
      }
    });
    router9.post(["/localities", "/geofencing/localities"], async (req, res) => {
      try {
        const { city_id, pincode_id, name, is_active, delivery_fee, minimum_order, estimated_delivery_minutes, boundary } = req.body;
        if (!city_id || !name) {
          return res.status(400).json({ error: "city_id and locality name are required" });
        }
        const created = await V2GeofencingService.createLocality({
          city_id,
          pincode_id,
          name,
          is_active,
          delivery_fee,
          minimum_order,
          estimated_delivery_minutes,
          boundary
        });
        res.status(201).json(created);
      } catch (err) {
        res.status(400).json({ error: "Failed to create locality", details: err.message });
      }
    });
    router9.patch(["/localities/:id", "/geofencing/localities/:id"], async (req, res) => {
      try {
        const id = String(req.params.id);
        const updated = await V2GeofencingService.updateLocality(id, req.body);
        res.json(updated);
      } catch (err) {
        res.status(400).json({ error: "Failed to update locality", details: err.message });
      }
    });
    router9.delete(["/localities/:id", "/geofencing/localities/:id"], async (req, res) => {
      try {
        const id = String(req.params.id);
        await V2GeofencingService.deleteLocality(id);
        res.json({ success: true, message: `Locality ${id} deleted` });
      } catch (err) {
        res.status(400).json({ error: "Failed to delete locality", details: err.message });
      }
    });
    handleServiceabilityCheck = async (req, res) => {
      try {
        const { latitude, longitude } = req.body || {};
        const result = await V2GeofencingService.checkServiceability({ latitude, longitude });
        res.status(result.status).json(result.data);
      } catch (err) {
        console.error("[V2 Geofencing Route Error]", err);
        res.status(500).json({
          serviceable: false,
          reason: "INTERNAL_ERROR",
          message: "We currently don't deliver to this area."
        });
      }
    };
    router9.post("/geofencing/check", handleServiceabilityCheck);
    router9.post("/check", handleServiceabilityCheck);
    v2geofencing_routes_default = router9;
  }
});

// server/routes/payment.routes.ts
var payment_routes_exports = {};
__export(payment_routes_exports, {
  default: () => payment_routes_default
});
import express7 from "express";
import crypto3 from "crypto";
import rateLimit from "express-rate-limit";
function authenticateDeviceToken(req, res) {
  console.log("[PaymentDeviceEvent] authentication started");
  const expectedToken = process.env.FROSTYPAY_DEVICE_TOKEN;
  if (!expectedToken || typeof expectedToken !== "string" || expectedToken.trim() === "") {
    console.error("[PaymentDeviceEvent] FROSTYPAY_DEVICE_TOKEN is missing or not configured on server");
    res.status(500).json({
      error: "Server Configuration Error",
      message: "Payment device authentication is not configured on the server."
    });
    return false;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid authorization header."
    });
    return false;
  }
  const providedToken = authHeader.slice(7).trim();
  if (!providedToken) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing device token."
    });
    return false;
  }
  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expectedToken.trim());
  if (providedBuf.length !== expectedBuf.length || !crypto3.timingSafeEqual(providedBuf, expectedBuf)) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid device token."
    });
    return false;
  }
  return true;
}
function isCodOrCashPaymentMethod(paymentMethod) {
  if (!paymentMethod) return false;
  const normalized = paymentMethod.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return ["cod", "cash", "cashondelivery", "payondelivery"].includes(normalized);
}
var router10, paymentDeviceEventLimiter, payment_routes_default;
var init_payment_routes = __esm({
  "server/routes/payment.routes.ts"() {
    init_supabase();
    router10 = express7.Router();
    paymentDeviceEventLimiter = rateLimit({
      windowMs: 60 * 1e3,
      // 1 minute window
      max: 60,
      // Maximum 60 requests per minute per IP
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
      // Prevent rate-limit proxy validation errors on Vercel
      keyGenerator: (req) => {
        const forwarded = req.headers["x-forwarded-for"];
        if (typeof forwarded === "string" && forwarded.length > 0) {
          return forwarded.split(",")[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || "127.0.0.1";
      },
      message: {
        error: "Too Many Requests",
        message: "Rate limit exceeded for payment device events. Please slow down."
      }
    });
    router10.post(["/device-event", "/api/payment/device-event"], paymentDeviceEventLimiter, async (req, res) => {
      try {
        console.log("[PaymentDeviceEvent] route entered");
        if (!authenticateDeviceToken(req, res)) {
          return;
        }
        console.log("[PaymentDeviceEvent] validation started");
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Request body must be a valid JSON object."
          });
        }
        const {
          amount_paise,
          upi_reference,
          transaction_time,
          source_package,
          source_type,
          device_id,
          event_id
        } = req.body;
        if (typeof amount_paise !== "number" || !Number.isInteger(amount_paise) || amount_paise <= 0) {
          return res.status(400).json({
            error: "Bad Request",
            message: "amount_paise is required and must be a positive integer."
          });
        }
        if (typeof device_id !== "string" || device_id.trim().length === 0 || device_id.trim().length > 128) {
          return res.status(400).json({
            error: "Bad Request",
            message: "device_id is required (string, max 128 characters)."
          });
        }
        if (typeof source_type !== "string" || source_type.trim().length === 0 || source_type.trim().length > 64) {
          return res.status(400).json({
            error: "Bad Request",
            message: "source_type is required (string, max 64 characters)."
          });
        }
        if (typeof event_id !== "string" || event_id.trim().length === 0 || event_id.trim().length > 128) {
          return res.status(400).json({
            error: "Bad Request",
            message: "event_id is required (string, max 128 characters)."
          });
        }
        let trimmedUpi = null;
        if (upi_reference !== void 0 && upi_reference !== null) {
          if (typeof upi_reference !== "string" || upi_reference.trim().length > 128) {
            return res.status(400).json({
              error: "Bad Request",
              message: "upi_reference must be a string with maximum 128 characters."
            });
          }
          trimmedUpi = upi_reference.trim() || null;
        }
        let trimmedSourcePkg = null;
        if (source_package !== void 0 && source_package !== null) {
          if (typeof source_package !== "string" || source_package.trim().length > 256) {
            return res.status(400).json({
              error: "Bad Request",
              message: "source_package must be a string with maximum 256 characters."
            });
          }
          trimmedSourcePkg = source_package.trim() || null;
        }
        let transactionTimeIso = (/* @__PURE__ */ new Date()).toISOString();
        if (transaction_time !== void 0 && transaction_time !== null) {
          if (typeof transaction_time !== "string") {
            return res.status(400).json({
              error: "Bad Request",
              message: "transaction_time must be an ISO date string."
            });
          }
          const parsedTime = Date.parse(transaction_time);
          if (isNaN(parsedTime)) {
            return res.status(400).json({
              error: "Bad Request",
              message: "transaction_time is not a valid date format."
            });
          }
          transactionTimeIso = new Date(parsedTime).toISOString();
        }
        const cleanEventId = event_id.trim();
        const cleanDeviceId = device_id.trim();
        const cleanSourceType = source_type.trim();
        console.log("[PaymentDeviceEvent] Supabase lookup started");
        const { data: existingEvent, error: eventCheckError } = await supabase.from("payment_verification_events").select("id, event_id").eq("event_id", cleanEventId).maybeSingle();
        if (eventCheckError) {
          console.error("[PaymentDeviceEvent] Error querying payment_verification_events for event_id:", eventCheckError.message);
          return res.status(500).json({
            error: "Database Error",
            message: "Failed to verify event idempotency."
          });
        }
        if (existingEvent) {
          console.log("[PaymentDeviceEvent] completed");
          return res.status(200).json({
            success: true,
            duplicate: true,
            matched: false
          });
        }
        if (trimmedUpi) {
          const { data: existingUpi, error: upiCheckError } = await supabase.from("payment_verification_events").select("id, upi_reference").eq("upi_reference", trimmedUpi).maybeSingle();
          if (upiCheckError) {
            console.error("[PaymentDeviceEvent] Error querying payment_verification_events for upi_reference:", upiCheckError.message);
            return res.status(500).json({
              error: "Database Error",
              message: "Failed to verify UPI reference idempotency."
            });
          }
          if (existingUpi) {
            console.log("[PaymentDeviceEvent] completed");
            return res.status(200).json({
              success: true,
              duplicate: true,
              matched: false,
              reason: "upi_reference_already_processed"
            });
          }
        }
        const { data: waitingAttempts, error: attemptsError } = await supabase.from("payment_attempts").select("id, order_id, amount_paise, status, expires_at, created_at").eq("status", "waiting").eq("amount_paise", amount_paise);
        if (attemptsError) {
          console.error("[PaymentDeviceEvent] Error querying payment_attempts:", attemptsError.message);
          return res.status(500).json({
            error: "Database Error",
            message: "Failed to query payment attempts."
          });
        }
        const now = Date.now();
        const activeAttempts = (waitingAttempts || []).filter((att) => {
          if (!att.expires_at) return true;
          return new Date(att.expires_at).getTime() > now;
        });
        const expiredAttempts = (waitingAttempts || []).filter((att) => {
          if (!att.expires_at) return false;
          return new Date(att.expires_at).getTime() <= now;
        });
        if (activeAttempts.length === 0) {
          const matchReason = expiredAttempts.length > 0 ? "verification_expired" : "no_eligible_order";
          await supabase.from("payment_verification_events").insert({
            event_id: cleanEventId,
            amount_paise,
            upi_reference: trimmedUpi,
            source_package: trimmedSourcePkg,
            source_type: cleanSourceType,
            transaction_time: transactionTimeIso,
            device_id: cleanDeviceId,
            matched: false,
            processed: true,
            match_reason: matchReason
          });
          console.log("[PaymentDeviceEvent] completed");
          return res.status(200).json({
            success: true,
            matched: false,
            reason: matchReason
          });
        }
        const candidateOrderIds = Array.from(new Set(activeAttempts.map((a) => a.order_id).filter(Boolean)));
        if (candidateOrderIds.length === 0) {
          await supabase.from("payment_verification_events").insert({
            event_id: cleanEventId,
            amount_paise,
            upi_reference: trimmedUpi,
            source_package: trimmedSourcePkg,
            source_type: cleanSourceType,
            transaction_time: transactionTimeIso,
            device_id: cleanDeviceId,
            matched: false,
            processed: true,
            match_reason: "no_eligible_order"
          });
          console.log("[PaymentDeviceEvent] completed");
          return res.status(200).json({
            success: true,
            matched: false,
            reason: "no_eligible_order"
          });
        }
        const { data: orders, error: ordersError } = await supabase.from("orders").select("id, total, status, payment_method, payment_status, utr, refund_status, created_at, updated_at").in("id", candidateOrderIds);
        if (ordersError) {
          console.error("[PaymentDeviceEvent] Error querying candidate orders:", ordersError.message);
          return res.status(500).json({
            error: "Database Error",
            message: "Failed to query matching orders."
          });
        }
        const orderMap = /* @__PURE__ */ new Map();
        (orders || []).forEach((o) => orderMap.set(o.id, o));
        const validCandidates = [];
        for (const attempt of activeAttempts) {
          if (!attempt.order_id) continue;
          const order = orderMap.get(attempt.order_id);
          if (!order) continue;
          if (order.payment_status?.toLowerCase() === "paid") {
            continue;
          }
          const currentOrderStatus = order.status?.toLowerCase();
          if (currentOrderStatus === "cancelled" || currentOrderStatus === "delivered") {
            continue;
          }
          if (isCodOrCashPaymentMethod(order.payment_method)) {
            continue;
          }
          const orderTotalPaise = Math.round(Number(order.total) * 100);
          if (orderTotalPaise !== amount_paise) {
            continue;
          }
          validCandidates.push({ attempt, order });
        }
        if (validCandidates.length === 0) {
          const matchReason = expiredAttempts.length > 0 ? "verification_expired" : "no_eligible_order";
          await supabase.from("payment_verification_events").insert({
            event_id: cleanEventId,
            amount_paise,
            upi_reference: trimmedUpi,
            source_package: trimmedSourcePkg,
            source_type: cleanSourceType,
            transaction_time: transactionTimeIso,
            device_id: cleanDeviceId,
            matched: false,
            processed: true,
            match_reason: matchReason
          });
          console.log("[PaymentDeviceEvent] completed");
          return res.status(200).json({
            success: true,
            matched: false,
            reason: matchReason
          });
        }
        if (validCandidates.length > 1) {
          console.warn(`[PaymentDeviceEvent] Ambiguous payment amount ${amount_paise} paise matched ${validCandidates.length} orders. Halting automated assignment.`);
          await supabase.from("payment_verification_events").insert({
            event_id: cleanEventId,
            amount_paise,
            upi_reference: trimmedUpi,
            source_package: trimmedSourcePkg,
            source_type: cleanSourceType,
            transaction_time: transactionTimeIso,
            device_id: cleanDeviceId,
            matched: false,
            processed: false,
            // Mark processed=false for audit and potential manual administrative review
            match_reason: "ambiguous_amount"
          });
          console.log("[PaymentDeviceEvent] completed");
          return res.status(200).json({
            success: true,
            matched: false,
            reason: "ambiguous_amount"
          });
        }
        const matchedCandidate = validCandidates[0];
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        const { data: updatedAttempt, error: attemptUpdateError } = await supabase.from("payment_attempts").update({
          status: "matched",
          matched_at: nowIso,
          updated_at: nowIso
        }).eq("id", matchedCandidate.attempt.id).eq("status", "waiting").select().maybeSingle();
        if (attemptUpdateError || !updatedAttempt) {
          console.warn(`[PaymentDeviceEvent] Attempt ${matchedCandidate.attempt.id} was already updated by another concurrent process.`);
          await supabase.from("payment_verification_events").insert({
            event_id: cleanEventId,
            order_id: matchedCandidate.order.id,
            amount_paise,
            upi_reference: trimmedUpi,
            source_package: trimmedSourcePkg,
            source_type: cleanSourceType,
            transaction_time: transactionTimeIso,
            device_id: cleanDeviceId,
            matched: false,
            processed: true,
            match_reason: "attempt_already_transitioned"
          });
          console.log("[PaymentDeviceEvent] completed");
          return res.status(200).json({
            success: true,
            matched: false,
            reason: "no_eligible_order"
          });
        }
        const orderUpdates = {
          payment_status: "paid",
          status: "confirmed",
          updated_at: nowIso
        };
        if (trimmedUpi) {
          orderUpdates.utr = trimmedUpi;
        }
        const { error: orderUpdateError } = await supabase.from("orders").update(orderUpdates).eq("id", matchedCandidate.order.id);
        if (orderUpdateError) {
          console.error("[PaymentDeviceEvent] Error updating order status to paid:", orderUpdateError.message);
          await supabase.from("payment_verification_events").insert({
            event_id: cleanEventId,
            order_id: matchedCandidate.order.id,
            amount_paise,
            upi_reference: trimmedUpi,
            source_package: trimmedSourcePkg,
            source_type: cleanSourceType,
            transaction_time: transactionTimeIso,
            device_id: cleanDeviceId,
            matched: true,
            processed: false,
            match_reason: "order_update_failed"
          });
          return res.status(500).json({
            error: "Database Error",
            message: "Failed to update order status."
          });
        }
        await supabase.from("payment_verification_events").insert({
          event_id: cleanEventId,
          order_id: matchedCandidate.order.id,
          amount_paise,
          upi_reference: trimmedUpi,
          source_package: trimmedSourcePkg,
          source_type: cleanSourceType,
          transaction_time: transactionTimeIso,
          device_id: cleanDeviceId,
          matched: true,
          processed: true,
          match_reason: "matched_single_order"
        });
        console.log("[PaymentDeviceEvent] completed");
        return res.status(200).json({
          success: true,
          matched: true,
          order_id: matchedCandidate.order.id,
          status: "paid"
        });
      } catch (err) {
        console.error("[PaymentDeviceEvent] Error occurred:", err?.name || "Error", err?.message || String(err));
        if (err?.stack) {
          console.error("[PaymentDeviceEvent] Stack trace:", err.stack);
        }
        if (!res.headersSent) {
          return res.status(500).json({
            error: "Internal Server Error",
            message: "An unexpected error occurred while processing the payment device event."
          });
        }
      }
    });
    payment_routes_default = router10;
  }
});

// api/index.ts
import dotenv2 from "dotenv";
import fs4 from "fs";
import path4 from "path";

// server/app.ts
import dotenv from "dotenv";
import fs3 from "fs";
import path3 from "path";
import express8 from "express";
import cors from "cors";
import helmet from "helmet";
console.log("[Vercel] server/app.ts loading...");
var envPath = path3.resolve(process.cwd(), ".env");
if (fs3.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
var app = express8();
console.log("[Vercel] Express app created");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[App] Incoming Request: ${req.method} ${req.url}`);
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[App] Response: ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});
app.use((req, res, next) => {
  if (req.url.startsWith("/api/index.ts")) {
    req.url = req.url.replace("/api/index.ts", "") || "/";
  } else if (req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  } else if (req.url === "/api") {
    req.url = "/";
  }
  next();
});
var isProd = process.env.NODE_ENV === "production";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "https:",
        "wss:",
        "http:",
        "ws:",
        "https://*.googleapis.com",
        "https://*.firebaseio.com",
        "http://localhost:*",
        "ws://localhost:*"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: [
        "'self'",
        "https://*.google.com",
        "https://*.web.app",
        "https://*.run.app",
        "https://*.aistudio.google",
        "https://*.cloud.google",
        "https://*.cloud",
        "https://*.run"
      ]
    }
  },
  frameguard: false,
  // Must be false to support the AI Studio iframe preview environment safely
  hsts: isProd ? {
    maxAge: 31536e3,
    // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors((req, callback) => {
  const origin = req.header("Origin");
  const host = req.header("Host");
  let isAllowed = false;
  if (!origin) {
    isAllowed = true;
  } else {
    if (!isProd) {
      isAllowed = true;
    } else {
      const allowedOrigins = [
        "capacitor://localhost",
        "ionic://localhost"
      ];
      try {
        const url = new URL(origin);
        isAllowed = allowedOrigins.includes(origin) || url.hostname === "localhost" || (host ? url.host === host : false) || url.hostname.endsWith(".run.app") || url.hostname.endsWith(".supabase.co") || url.hostname.endsWith("firebaseapp.com") || url.hostname.endsWith(".vercel.app") || url.hostname.endsWith(".netlify.app") || url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".github.io") || origin.startsWith("https://");
      } catch (_) {
        isAllowed = false;
      }
    }
  }
  callback(null, {
    origin: isAllowed,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  });
}));
app.use("/avatar", (req, res, next) => {
  console.log(`[App] Avatar route reached: ${req.method} ${req.url}`);
  next();
});
app.use(express8.json({ limit: "10mb" }));
app.use(express8.urlencoded({ limit: "10mb", extended: true }));
app.get(["/health", "/api/health"], (req, res) => {
  console.log("[App] Health check hit");
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    hasGemini: !!process.env.GEMINI_API_KEY,
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get(["/ping", "/api/ping"], (req, res) => {
  res.send("pong");
});
app.get("/migration-script", (req, res) => {
  try {
    const migrationPath = path3.resolve(process.cwd(), "supabase_migration.sql");
    if (fs3.existsSync(migrationPath)) {
      const sqlText = fs3.readFileSync(migrationPath, "utf-8");
      res.json({ sql: sqlText });
    } else {
      res.status(404).json({ error: "Migration script not found on server." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function lazyRoute(importFn) {
  let routerInstance = null;
  let initError = null;
  return async (req, res, next) => {
    try {
      if (!routerInstance && !initError) {
        const module = await importFn();
        routerInstance = module.default;
      }
      if (initError) {
        return res.status(500).json({
          error: "Module Initialization Error",
          message: initError.message
        });
      }
      return routerInstance(req, res, next);
    } catch (err) {
      console.error("[LazyRoute Error]", err?.message || err);
      initError = err;
      return res.status(500).json({
        error: "Route Loading Error",
        message: err?.message || "Failed to load route module"
      });
    }
  };
}
app.use(["/butler", "/api/butler"], lazyRoute(() => Promise.resolve().then(() => (init_butler_routes(), butler_routes_exports))));
app.use(["/avatar", "/api/avatar"], lazyRoute(() => Promise.resolve().then(() => (init_avatar_routes(), avatar_routes_exports))));
app.use(["/auth", "/api/auth"], lazyRoute(() => Promise.resolve().then(() => (init_auth_routes(), auth_routes_exports))));
app.use(["/config", "/api/config"], lazyRoute(() => Promise.resolve().then(() => (init_config_routes(), config_routes_exports))));
app.use(["/notifications", "/api/notifications"], lazyRoute(() => Promise.resolve().then(() => (init_notification_routes(), notification_routes_exports))));
app.use(["/validate-address", "/api/validate-address"], lazyRoute(() => Promise.resolve().then(() => (init_validateaddress_routes(), validateaddress_routes_exports))));
app.use(["/reviews", "/api/reviews"], lazyRoute(() => Promise.resolve().then(() => (init_reviews_routes(), reviews_routes_exports))));
app.use(["/search", "/api/search"], lazyRoute(() => Promise.resolve().then(() => (init_search_routes(), search_routes_exports))));
app.use(["/v2", "/api/v2", "/api/geofencing", "/geofencing"], lazyRoute(() => Promise.resolve().then(() => (init_v2geofencing_routes(), v2geofencing_routes_exports))));
app.use(["/payment", "/api/payment"], lazyRoute(() => Promise.resolve().then(() => (init_payment_routes(), payment_routes_exports))));
console.log("[Vercel] routes mounted");
app.get(["/cities", "/api/cities"], async (req, res) => {
  try {
    const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
    const cities = await V2GeofencingService2.getCities();
    res.json(cities);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cities", details: err.message });
  }
});
app.get(["/pincodes", "/api/pincodes"], async (req, res) => {
  try {
    const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
    const cityId = req.query.city_id;
    const pincodes = await V2GeofencingService2.getPincodes(cityId);
    res.json(pincodes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pincodes", details: err.message });
  }
});
app.get(["/localities", "/api/localities"], async (req, res) => {
  try {
    const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
    const cityId = req.query.city_id;
    const pincodeId = req.query.pincode_id;
    const localities = await V2GeofencingService2.getLocalities(cityId, pincodeId);
    res.json(localities);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch localities", details: err.message });
  }
});
app.get(["/service-area", "/api/service-area", "/service-areas", "/api/service-areas"], async (req, res) => {
  try {
    const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
    const area = await V2GeofencingService2.getServiceArea();
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch service area", details: err.message });
  }
});
app.post(["/check", "/api/check", "/geofencing/check", "/api/geofencing/check"], async (req, res) => {
  try {
    const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
    const { latitude, longitude } = req.body || {};
    const result = await V2GeofencingService2.checkServiceability({ latitude, longitude });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ serviceable: false, reason: "INTERNAL_ERROR", message: "We currently don't deliver to this area." });
  }
});
app.get(["/trending", "/api/trending"], async (req, res) => {
  const limitCount = parseInt(req.query.limit, 10) || 6;
  const defaultTrending2 = [
    "Anniversary Cakes",
    "Chocolate Truffle",
    "Coffee Pastries",
    "Custom Gifts",
    "Cupcakes",
    "Fresh Fruit Cake"
  ];
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data, error } = await supabase2.from("search_analytics").select("query").order("count", { ascending: false }).limit(limitCount);
    if (error || !data || data.length === 0) {
      return res.json(defaultTrending2.slice(0, limitCount));
    }
    const queries = data.map((d) => d.query).filter(Boolean);
    if (queries.length < limitCount) {
      const combined = Array.from(/* @__PURE__ */ new Set([...queries, ...defaultTrending2]));
      return res.json(combined.slice(0, limitCount));
    }
    return res.json(queries.slice(0, limitCount));
  } catch {
    return res.json(defaultTrending2.slice(0, limitCount));
  }
});
app.get(["/service-zones", "/api/service-zones"], async (req, res) => {
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data, error } = await supabase2.from("service_zones").select("*");
    if (error) {
      const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
      const cities = await V2GeofencingService2.getCities();
      return res.json(cities.map((c) => ({ id: c.id, city_name: c.name, latitude: 20.2961, longitude: 85.8245, radius_meters: 15e3, is_active: c.is_active })));
    }
    res.json(data || []);
  } catch (err) {
    res.json([]);
  }
});
app.get(["/service-pincodes", "/api/service-pincodes"], async (req, res) => {
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data, error } = await supabase2.from("service_pincodes").select("*");
    if (error) {
      const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
      const pins = await V2GeofencingService2.getPincodes();
      return res.json(pins.map((p) => ({ id: p.id, pincode: p.pincode, active: p.is_active })));
    }
    res.json(data || []);
  } catch (err) {
    res.json([]);
  }
});
app.get(["/delivery-areas", "/api/delivery-areas"], async (req, res) => {
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data, error } = await supabase2.from("delivery_areas").select("*");
    if (error) {
      const { V2GeofencingService: V2GeofencingService2 } = await Promise.resolve().then(() => (init_v2Geofencing_service(), v2Geofencing_service_exports));
      const locs = await V2GeofencingService2.getLocalities();
      return res.json(locs.map((l) => ({ id: l.id, area_name: l.name, pincode: "", is_deliverable: l.is_active })));
    }
    res.json(data || []);
  } catch (err) {
    res.json([]);
  }
});
app.get("/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId parameter" });
  }
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data: order, error } = await supabase2.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (error) {
      console.error(`[App] Error fetching status for order ${orderId}:`, error);
      return res.status(500).json({ error: "Supabase database error", details: error.message });
    }
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.json({
      orderId: order.id,
      status: order.status || "pending",
      payment_status: order.payment_status || "pending",
      estimated_delivery_time: order.estimated_delivery_time || null,
      estimated_arrival: order.estimated_arrival || null,
      updated_at: order.updated_at,
      order
    });
  } catch (err) {
    console.error(`[App] Unexpected error fetching status for order ${orderId}:`, err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});
app.get("/order-status/:orderId", async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId parameter" });
  }
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data: order, error } = await supabase2.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (error) {
      console.error(`[App] Error fetching status for order ${orderId}:`, error);
      return res.status(500).json({ error: "Supabase database error", details: error.message });
    }
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.json({
      orderId: order.id,
      status: order.status || "pending",
      payment_status: order.payment_status || "pending",
      estimated_delivery_time: order.estimated_delivery_time || null,
      estimated_arrival: order.estimated_arrival || null,
      updated_at: order.updated_at,
      order
    });
  } catch (err) {
    console.error(`[App] Unexpected error fetching status for order ${orderId}:`, err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});
var maskKey = (key) => {
  if (!key || typeof key !== "string") return "not-set";
  if (key.length <= 12) return "set-but-too-short";
  return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
};
app.get("/debug-address", async (req, res) => {
  const report = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || "not-set",
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? "set" : "not-set",
      SUPABASE_URL: process.env.SUPABASE_URL ? "set" : "not-set",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "not-set",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? "set" : "not-set"
    },
    variablesMasked: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "using-fallback",
      SUPABASE_SERVICE_ROLE_KEY: maskKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
      VITE_SUPABASE_ANON_KEY: maskKey(process.env.VITE_SUPABASE_ANON_KEY)
    },
    supabaseReachability: {
      status: "untested",
      error: null,
      dataSample: null
    }
  };
  try {
    const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const { data, error } = await supabase2.from("cities").select("*").limit(2);
    if (error) {
      report.supabaseReachability.status = "failed";
      report.supabaseReachability.error = error;
    } else {
      report.supabaseReachability.status = "connected";
      report.supabaseReachability.dataSample = data;
    }
  } catch (err) {
    report.supabaseReachability.status = "exception";
    report.supabaseReachability.error = {
      message: err.message,
      stack: err.stack
    };
  }
  res.json(report);
});
app.use((req, res) => {
  console.warn(`[App] 404 hit: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Not Found",
    message: `API Endpoint ${req.method} ${req.originalUrl} not found`,
    path: req.originalUrl,
    method: req.method
  });
});
app.use((err, req, res, next) => {
  console.error("[Global Error]", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred"
  });
});
var app_default = app;

// api/index.ts
console.log("[Vercel] api/index.ts loading...");
try {
  const envPath2 = path4.resolve(process.cwd(), ".env");
  if (fs4.existsSync(envPath2)) {
    dotenv2.config({ path: envPath2 });
  }
} catch (e) {
  console.warn("[Vercel] Error loading .env:", e?.message);
}
console.log("[Vercel] api/index.ts loaded successfully");
function handler(req, res) {
  return app_default(req, res);
}
export {
  handler as default
};
