/**
 * Core content moderation logic
 * Single source of truth for moderation decisions
 */

import { callModerationAPI, callVisionAPI } from "./openai-client.ts";
import { checkContentThresholds } from "./thresholds.ts";
import type { ImageModerationResult } from "./types.ts";

/**
 * Moderates a single image through complete pipeline:
 * 1. Safety check (OpenAI Moderation API for sexual, violence, etc.)
 * 2. Human/Pet detection (OpenAI Vision API)
 * 
 * Returns approved=true only if both checks pass
 */
export async function moderateSingleImage(
  apiKey: string,
  base64Image: string
): Promise<ImageModerationResult> {
  // Step 1: Safety check
  const safetyResult = await callModerationAPI(apiKey, "image", base64Image);
  
  if (!safetyResult.success) {
    console.error("[MODERATION] Safety check failed, rejecting:", safetyResult.error);
    return { approved: false, reason: "content_flagged", scores: null };
  }

  const { flagged, category_scores } = safetyResult.results![0];

  // Check if flagged by OpenAI
  if (flagged) {
    console.log("[MODERATION] Image flagged by OpenAI safety check");
    return { approved: false, reason: "content_flagged", scores: category_scores };
  }

  // Check thresholds
  const thresholdReason = checkContentThresholds(category_scores, "image");
  if (thresholdReason) {
    console.log("[MODERATION] Image failed threshold check:", thresholdReason);
    return { approved: false, reason: "sensitive_content", scores: category_scores };
  }

  // Step 2: Human/Pet detection
  const humanDetection = await callVisionAPI(apiKey, [base64Image]);
  
  console.log("[DEBUG] Human detection result:", JSON.stringify(humanDetection));
  
  if (!humanDetection.success || !humanDetection.results) {
    console.error("[MODERATION] Human detection failed, rejecting:", humanDetection.error);
    return { approved: false, reason: "not_human", scores: category_scores };
  }

  const isHumanOrPet = humanDetection.results[0];
  if (!isHumanOrPet) {
    console.log("[MODERATION] Image rejected: not human/pet");
    return { approved: false, reason: "not_human", scores: category_scores };
  }

  console.log("[MODERATION] Image approved: passed safety and human/pet check");
  return { approved: true, reason: null, scores: category_scores };
}
