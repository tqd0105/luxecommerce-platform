import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  // Log a warning during local development if key is missing
  console.warn("⚠️ Warning: GEMINI_API_KEY is not defined in environment variables.");
}

/**
 * Singleton GoogleGenAI instance for server-side operations.
 * Must NEVER be imported into Client Components ('use client')
 * to ensure your API Key remains confidential.
 */
export const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const FALLBACK_GEMINI_MODEL = "gemini-3.8-flash";

