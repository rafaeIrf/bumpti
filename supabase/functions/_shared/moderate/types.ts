/**
 * Type definitions for content moderation system
 */

export interface SingleModerationRequest {
  type: "text" | "image";
  content: string;
}

export interface BatchModerationRequest {
  type: "batch-images";
  images: string[];
}

export type ModerationRequest = SingleModerationRequest | BatchModerationRequest;

export interface SingleModerationResponse {
  approved: boolean;
  reason: "content_flagged" | "sensitive_content" | "personal_data_detected" | "not_human" | "underage_detected" | null;
}

export interface BatchModerationResponse {
  results: {
    approved: boolean;
    reason: "content_flagged" | "sensitive_content" | "not_human" | "underage_detected" | null;
  }[];
  processedCount: number;
}

export interface OpenAIModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

export interface ImageModerationResult {
  approved: boolean;
  reason: "content_flagged" | "sensitive_content" | "not_human" | "underage_detected" | null;
  scores: Record<string, number> | null;
}
