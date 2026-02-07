/**
 * Moderation module types
 */

// Single content moderation
export type ModerationContentType = "text" | "image";

export type ModerationRejectionReason =
  | "content_flagged"
  | "sensitive_content"
  | "personal_data_detected"
  | "not_human"
  | "underage_detected";

export interface ModerationResult {
  approved: boolean;
  reason: ModerationRejectionReason | null;
}

// Batch moderation (for multiple profile photos)
export type BatchModerationReason =
  | "content_flagged"
  | "sensitive_content"
  | "not_human"
  | "underage_detected";

export interface BatchModerationResultItem {
  approved: boolean;
  reason: BatchModerationReason | null;
}

export interface BatchModerationResult {
  results: BatchModerationResultItem[];
  processedCount: number;
}
