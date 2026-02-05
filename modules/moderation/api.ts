import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";

export type ModerationContentType = "text" | "image";

export type ModerationRejectionReason =
  | "content_flagged"
  | "sensitive_content"
  | "personal_data_detected";

export interface ModerationResult {
  approved: boolean;
  reason: ModerationRejectionReason | null;
}

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
