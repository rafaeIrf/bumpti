import { SubscriptionData } from "@/modules/store/slices/profileSlice";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { Platform } from "react-native";

interface ValidateReceiptParams {
  receiptBody: Record<string, any>;
  isTest?: boolean;
}

/**
 * Validates an IAP receipt with the Bumpti backend.
 *
 * NOTE: This is a simulation since the actual backend endpoint is not provided.
 * In a real scenario, this would POST the receipt to your backend.
 */
export async function validateReceiptWithBackend(
  transaction: any,
  isConsumable: boolean
): Promise<SubscriptionData | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("User not authenticated");

    logger.log("[IAP] Validating receipt with backend edge function:", {
      isConsumable,
      transactionId: transaction.transactionId,
      platform: Platform.OS,
    });

    const { data, error } = await supabase.functions.invoke("iap-validate", {
      body: {
        platform: Platform.OS,
        purchase: transaction,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      throw new Error("Validation returned unsuccessful status");
    }

    logger.log("[IAP] Backend validation successful. Entitlements:", data.entitlements);

    return data.entitlements;
  } catch (error) {
    logger.error("[IAP] Backend validation failed:", error);
    return null;
  }
}
