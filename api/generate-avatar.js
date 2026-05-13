export default async function handler(req, res) {
  // =========================================
  // CORS
  // =========================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // =========================================
  // ONLY ALLOW POST
  // =========================================
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    // =========================================
    // BODY
    // =========================================
    const {
      imageUrl,
      prompt,
      userId,
    } = req.body || {};

    // =========================================
    // VALIDATION
    // =========================================
    if (!imageUrl) {
      return res.status(400).json({
        error: "Missing imageUrl",
      });
    }

    // =========================================
    // ENV VARIABLES
    // =========================================
    const HF_TOKEN =
      process.env.HF_TOKEN;

    const GEMINI_API_KEY =
      process.env.GEMINI_API_KEY;

    // =========================================
    // DEFAULT PROMPT
    // =========================================
    const finalPrompt =
      prompt ||
      `
Cute bakery themed chibi avatar,
anime inspired,
soft pastel colors,
big expressive eyes,
cozy cafe vibe,
holding dessert,
adorable kawaii character,
Instagram profile picture,
clean background
`;

    // =========================================
    // TRY HUGGING FACE FIRST
    // =========================================
    if (HF_TOKEN) {
      try {
        const hfResponse = await fetch(
          "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              inputs: `
${finalPrompt}

Reference selfie:
${imageUrl}
`,
              options: {
                wait_for_model: true,
              },
            }),
          }
        );

        // =========================================
        // IMAGE SUCCESS
        // =========================================
        if (hfResponse.ok) {
          const contentType =
            hfResponse.headers.get(
              "content-type"
            );

          if (
            contentType &&
            contentType.includes("image")
          ) {
            const arrayBuffer =
              await hfResponse.arrayBuffer();

            const base64 =
              Buffer.from(
                arrayBuffer
              ).toString("base64");

            return res.status(200).json({
              success: true,
              provider:
                "huggingface",
              image: `data:image/png;base64,${base64}`,
            });
          }

          // HF SOMETIMES RETURNS JSON
          const text =
            await hfResponse.text();

          let data = {};

          try {
            data = text
              ? JSON.parse(text)
              : {};
          } catch {}

          console.log(
            "HF JSON:",
            data
          );
        } else {
          console.log(
            "HF FAILED:",
            hfResponse.status
          );
        }
      } catch (hfError) {
        console.error(
          "HF ERROR:",
          hfError
        );
      }
    }

    // =========================================
    // GEMINI FALLBACK
    // =========================================
    if (GEMINI_API_KEY) {
      try {
        const geminiResponse =
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `
Generate a cute foodie personality note
for this avatar.

Style:
- cozy
- kawaii
- bakery themed
- aesthetic
- social media friendly

Avatar vibe:
${finalPrompt}
`,
                      },
                    ],
                  },
                ],
              }),
            }
          );

        const text =
          await geminiResponse.text();

        let data = {};

        try {
          data = text
            ? JSON.parse(text)
            : {};
        } catch {}

        const note =
          data?.candidates?.[0]
            ?.content?.parts?.[0]
            ?.text ||
          "Freshly baked with cozy energy ☕🥐";

        // =========================================
        // FALLBACK IMAGE
        // =========================================
        const fallbackImage =
          `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
            userId ||
              Math.random()
                .toString(36)
                .substring(7)
          )}`;

        return res.status(200).json({
          success: true,
          provider: "gemini",
          image: fallbackImage,
          note,
        });
      } catch (geminiError) {
        console.error(
          "GEMINI ERROR:",
          geminiError
        );
      }
    }

    // =========================================
    // FINAL FALLBACK
    // =========================================
    return res.status(200).json({
      success: true,
      provider: "dicebear",
      image:
        "https://api.dicebear.com/7.x/adventurer/svg?seed=bakery",
      note:
        "Powered by cupcakes and cozy cafe vibes 🧁✨",
    });
  } catch (error) {
    console.error(
      "CRITICAL SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Internal server error",
    });
  }
}