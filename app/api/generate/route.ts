import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs"; // VERY IMPORTANT for HF stability

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function callHuggingFace(prompt: string) {
  const res = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        options: {
          wait_for_model: true, // IMPORTANT (fixes cold start 503)
        },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "HuggingFace failed");
  }

  return data;
}

async function callGemini(prompt: string) {
  if (!process.env.GEMINI_API_KEY) return null;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // ===== 1. TRY HUGGING FACE FIRST =====
    try {
      const hfResult = await callHuggingFace(prompt);

      return NextResponse.json({
        source: "huggingface",
        result: hfResult,
      });
    } catch (hfError) {
      console.error("HF failed, falling back to Gemini:", hfError);

      // ===== 2. FALLBACK TO GEMINI =====
      const geminiResult = await callGemini(prompt);

      return NextResponse.json({
        source: "gemini",
        result: geminiResult,
      });
    }
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        error: error.message || "Server error",
      },
      { status: 500 }
    );
  }
}