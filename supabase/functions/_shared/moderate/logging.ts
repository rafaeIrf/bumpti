/**
 * Database logging utilities for content moderation
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/**
 * Logs moderation result to database for audit
 * Does not store raw content (base64/text) for privacy and disk savings
 */
export async function logModerationResult(
  supabase: SupabaseClient,
  userId: string,
  contentType: "text" | "image" | "batch-images",
  status: "approved" | "rejected" | "passed_by_error",
  rejectionReason: string | null,
  aiScores: Record<string, number> | null,
  imageCount?: number
): Promise<void> {
  const { error } = await supabase.from("content_moderation_logs").insert({
    user_id: userId,
    content_type: contentType,
    status,
    rejection_reason: rejectionReason,
    ai_scores: aiScores,
    image_count: imageCount,
  });
  
  if (error) {
    console.error("Failed to log moderation result:", error);
  }
}
