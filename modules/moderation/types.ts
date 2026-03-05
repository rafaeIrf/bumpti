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
  /** SHA-256 hash of the image (only present for approved images) */
  hash?: string;
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
  /** SHA-256 hash of the image (only present for approved images) */
  hash?: string;
}

export interface BatchModerationResult {
  results: BatchModerationResultItem[];
  processedCount: number;
}
