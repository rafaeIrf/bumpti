import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import type {
  BatchModerationResult,
  ModerationContentType,
  ModerationResult,
} from "./types";

// Re-export types for consumers
export type {
  BatchModerationReason,
  BatchModerationResult,
  BatchModerationResultItem,
  ModerationContentType,
  ModerationRejectionReason,
  ModerationResult
} from "./types";

/**
 * Moderates content (text or image) using the backend moderation service.
 *
 * For images, pass a base64-encoded string (with or without data URI prefix).
 * For text, pass the raw text content.
 *
 * @param type - Type of content: "text" or "image"
 * @param content - The content to moderate (text string or base64 image)
 * @returns ModerationResult with approved status and optional rejection reason
 */
export async function moderateContent(
  type: ModerationContentType,
  content: string
): Promise<ModerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke<ModerationResult>(
      "moderate-content",
      {
        body: { type, content },
      }
    );

    if (error) {
      logger.error("Moderation API error:", error);
      // Fail-safe: approve on error to not block user
      return { approved: true, reason: null };
    }

    return data ?? { approved: true, reason: null };
  } catch (error) {
    logger.error("Moderation service call failed:", error);
    // Fail-safe: approve on error to not block user
    return { approved: true, reason: null };
  }
}

/**
 * Moderates a profile photo before upload.
 * Handles base64 conversion internally if needed.
 *
 * @param base64Image - Base64-encoded image (with or without data URI prefix)
 * @returns ModerationResult
 */
export async function moderateProfilePhoto(
  base64Image: string
): Promise<ModerationResult> {
  return moderateContent("image", base64Image);
}

/**
 * Moderates biography text before saving.
 *
 * @param bioText - The biography text to validate
 * @returns ModerationResult
 */
export async function moderateBioText(
  bioText: string
): Promise<ModerationResult> {
  // Skip moderation for empty bios
  if (!bioText.trim()) {
    return { approved: true, reason: null };
  }

  return moderateContent("text", bioText);
}

// ============================================================================
// Batch Moderation (for multiple profile photos)
// ============================================================================

/**
 * Moderates multiple profile photos in a single batch request.
 * Uses GPT-4o-mini with low detail for cost-efficient human/pet detection.
 *
 * @param base64Images - Array of base64-encoded images (max 9)
 * @returns BatchModerationResult with approval status for each image
 */
export async function moderateProfilePhotosBatch(
  base64Images: string[]
): Promise<BatchModerationResult> {
  if (base64Images.length === 0) {
    return { results: [], processedCount: 0 };
  }

  if (base64Images.length > 9) {
    logger.warn("Batch moderation: truncating to 9 images");
    base64Images = base64Images.slice(0, 9);
  }

  try {
    const { data, error } = await supabase.functions.invoke<BatchModerationResult>(
      "moderate-content",
      {
        body: { type: "batch-images", images: base64Images },
      }
    );

    if (error) {
      logger.error("Batch moderation API error:", error);
      // Fail-safe: approve all on error
      return {
        results: base64Images.map(() => ({ approved: true, reason: null })),
        processedCount: base64Images.length,
      };
    }

    return data ?? {
        results: base64Images.map(() => ({ approved: true, reason: null })),
        processedCount: base64Images.length,
      };
  } catch (error) {
    logger.error("Batch moderation service call failed:", error);
    // Fail-safe: approve all on error
    return {
      results: base64Images.map(() => ({ approved: true, reason: null })),
      processedCount: base64Images.length,
    };
  }
}
