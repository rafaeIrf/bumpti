/**
 * OpenAI API client for content moderation
 * Handles both Moderation API (safety) and Chat Completions API (human/pet detection)
 */

import type { OpenAIModerationResult } from "./types.ts";

// API Configuration
const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODERATION_MODEL = "omni-moderation-latest";
const OPENAI_VISION_MODEL = "gpt-4o-mini";

/**
 * Calls OpenAI Moderation API for safety check
 * Supports: single text or single image
 * 
 * Note: OpenAI Moderation API has a limit of 1 image per request
 */
export async function callModerationAPI(
  apiKey: string,
  type: "text" | "image",
  content: string
): Promise<{ success: boolean; results?: OpenAIModerationResult[]; error?: string }> {
  try {
    let input: unknown;

    if (type === "image") {
      // Single image only
      const base64 = content as string;
      input = [{
        type: "image_url",
        image_url: {
          url: base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`,
        },
      }];
    } else {
      // Text
      input = content as string;
    }

    const response = await fetch(OPENAI_MODERATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODERATION_MODEL,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Moderation API error:", response.status, errorText);
      return { success: false, error: `OpenAI API error: ${response.status}` };
    }

    const data = await response.json();
    const results = data.results as OpenAIModerationResult[];

    if (!results || results.length === 0) {
      return { success: false, error: "No moderation results returned" };
    }

    return { success: true, results };
  } catch (error) {
    console.error("OpenAI moderation call failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Vision prompt for human/pet detection
 */
const HUMAN_DETECTION_PROMPT = `You are a strict content moderator for a social app.
Analyze each photo in the EXACT order they are provided.

DECISION LOGIC:
- APPROVE (true): The photo is a genuine personal photo of a real ADULT human (selfie, casual snapshot, group photo) OR a real PET (dog, cat, etc.).

- REJECT (false) if ANY of these apply:
    1. NOT AUTHENTIC: Stock photo, commercial/professional shoot, modeling portfolio, magazine spread, AI-generated portrait, or heavily digitally altered image.
       Signs: perfect studio lighting, flawless CGI-like skin, watermarks, overly polished composition, obvious AI artifacts (unnatural eyes/hands/background).
    2. CHILD SAFETY: The photo contains babies, infants, toddlers, or young children (even if an adult is present).
    3. LOW QUALITY: The photo is extremely blurry, dark, or unrecognizable.
    4. INVALID SUBJECT: The photo shows ONLY landscapes, cars, food, memes, cartoons, drawings, or objects.

OUTPUT: Return ONLY a JSON object with a "results" array of booleans.
Example: {"results": [true, false, true]}`;

/**
 * Calls OpenAI Chat Completions API with vision for batch human/pet detection
 * Uses gpt-4o-mini with detail: "low" for cost optimization
 */
export async function callVisionAPI(
  apiKey: string,
  images: string[]
): Promise<{ success: boolean; results?: boolean[]; error?: string }> {
  try {
    // Build content array with prompt + images
    const content: { type: string; text?: string; image_url?: { url: string; detail: string } }[] = [
      { type: "text", text: HUMAN_DETECTION_PROMPT },
    ];

    for (const base64 of images) {
      const url = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
      content.push({
        type: "image_url",
        image_url: { url, detail: "low" },
      });
    }

    // Timeout for resilience (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OPENAI_VISION_MODEL,
          messages: [
            { role: "system", content: "You are a strict data classifier. Always return valid JSON only, no extra text." },
            { role: "user", content }
          ],
          max_tokens: 150,
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Vision API error:", response.status, errorText);
        return { success: false, error: `OpenAI Vision API error: ${response.status}` };
      }

      const data = await response.json();
      const messageContent = data.choices?.[0]?.message?.content ?? "";
      
      // Log token usage for billing
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      console.log(`[BILLING] Vision API: ${images.length} photos. Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${promptTokens + completionTokens} total.`);

      // Parse JSON response
      const parsed = JSON.parse(messageContent);
      const results = parsed.results;
      
      if (!Array.isArray(results) || results.length !== images.length) {
        console.error("Results array mismatch:", results);
        return { success: false, error: "Results count mismatch" };
      }
      
      return { success: true, results };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("Vision API timeout after 30 seconds");
        return { success: false, error: "Vision API timeout" };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Vision API call failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
