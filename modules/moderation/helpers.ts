import { logger } from "@/utils/logger";
import { moderateBioText } from "./api";
import type { ModerationResult } from "./types";

/**
 * Configuration for text moderation
 */
export interface TextModerationConfig {
  /** The text content to moderate */
  text: string;
  /** Translation key for content rejection message */
  contentRejectedKey: string;
  /** Translation key for personal data rejection message */
  personalDataRejectedKey: string;
  /** Context string for error logging */
  errorContext: string;
}

/**
 * Moderates text content and handles the result.
 * Returns true if moderation passes or fails gracefully (fail-safe).
 * Returns false if moderation rejects the content.
 *
 * @param config - Configuration object with text and translation keys
 * @param setLoading - Function to update loading state
 * @param setError - Function to display error modal
 * @param t - Translation function
 * @returns Promise<boolean> - true if content is approved or error occurred (fail-safe), false if rejected
 */
export async function moderateTextContent(
  config: TextModerationConfig,
  setLoading: (loading: boolean) => void,
  setError: (error: { visible: boolean; message: string }) => void,
  t: (key: string) => string
): Promise<boolean> {
  setLoading(true);

  try {
    const result: ModerationResult = await moderateBioText(config.text);

    if (!result.approved) {
      setLoading(false);

      // Show semantic error message based on rejection reason
      const errorMessage =
        result.reason === "personal_data_detected"
          ? t(config.personalDataRejectedKey)
          : t(config.contentRejectedKey);

      setError({ visible: true, message: errorMessage });
      return false; // Content was rejected
    }
  } catch (error) {
    logger.error(config.errorContext, error);
    // Fail-safe: continue on error
  }

  setLoading(false);
  return true; // Content approved or error occurred (fail-safe)
}
