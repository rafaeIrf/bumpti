import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import Constants from "expo-constants";
import { Platform } from "react-native";

interface SubmitFeedbackParams {
  rating_type: "positive" | "negative";
  message?: string;
}

/**
 * Submit app feedback via edge function
 */
export async function submitAppFeedback(
  params: SubmitFeedbackParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await supabase.functions.invoke("submit-app-feedback", {
      body: {
        rating_type: params.rating_type,
        message: params.message || null,
      },
      headers: {
        "x-platform": Platform.OS,
        "x-app-version": Constants.expoConfig?.version || "1.0.0",
      },
    });

    if (response.error) {
      logger.error("Error submitting app feedback:", response.error);
      return { success: false, error: response.error.message };
    }

    logger.log(`App feedback submitted: ${params.rating_type}`);
    return { success: true };
  } catch (error) {
    logger.error("Unexpected error submitting app feedback:", error);
    return { success: false, error: "Failed to submit feedback" };
  }
}
