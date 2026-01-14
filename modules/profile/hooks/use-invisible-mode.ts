import { updateProfile } from "@/modules/profile/api";
import { useUserSubscription } from "@/modules/iap/hooks";
import { setInvisibleMode } from "@/modules/store/slices/profileActions";
import { useProfile } from "@/hooks/use-profile";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";

export function useInvisibleMode() {
  const { profile } = useProfile();
  const { isPremium } = useUserSubscription();
  const router = useRouter();

  const isInvisible = profile?.is_invisible ?? false;

  const toggleInvisibleMode = async () => {
    const newValue = !isInvisible;

    // Check if trying to enable invisible mode without premium
    if (newValue && !isPremium) {
      // Navigate to premium paywall
      router.push("/(modals)/premium-paywall");
      return;
    }

    const previousValue = isInvisible;

    // Optimistic update - update Redux immediately
    setInvisibleMode(newValue);

    try {
      await updateProfile({ is_invisible: newValue });
      logger.log(`[useInvisibleMode] Updated invisible mode to ${newValue}`);
    } catch (error: any) {
      logger.error("[useInvisibleMode] Failed to update invisible mode:", error);
      
      // Revert on error
      setInvisibleMode(previousValue);

      // Check if error is premium_required
      if (error?.message?.includes("premium_required") || error?.context?.body?.error === "premium_required") {
        // Navigate to paywall if backend rejects (extra safety)
        router.push("/(modals)/premium-paywall");
      }
    }
  };

  return { isInvisible, toggleInvisibleMode, isPremium };
}
