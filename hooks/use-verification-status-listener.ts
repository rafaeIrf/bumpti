import { fetchAndSetUserProfile, getUserId } from "@/modules/profile";
import { useAppDispatch } from "@/modules/store/hooks";
import type { VerificationStatus } from "@/modules/store/slices/profileSlice";
import { setVerificationStatus } from "@/modules/store/slices/profileSlice";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";

/**
 * Hook to listen for verification status updates via Realtime broadcast.
 * 
 * When the Didit webhook completes verification, it broadcasts an event to
 * the channel `user:${userId}` with event 'verification_status_updated'.
 * 
 * This hook subscribes to that channel and updates Redux when the status changes.
 * 
 * IMPORTANT: This hook must be used inside a component that is wrapped by ReduxProvider.
 */
export function useVerificationStatusListener() {
  const dispatch = useAppDispatch();
  const userId = getUserId();

  useEffect(() => {
    if (!userId) {
      return;
    }

    logger.log(`[VerificationListener] Subscribing to verification updates for user: ${userId}`);

    const channelName = `user:${userId}`;
    let channel: RealtimeChannel | null = null;

    try {
      channel = supabase
        .channel(channelName)
        .on("broadcast", { event: "verification_status_updated" }, (payload) => {
          logger.log("[VerificationListener] Received verification status update:", payload);

          const { verification_status } = payload.payload as {
            user_id: string;
            verification_status: VerificationStatus;
            updated_at: string;
          };

          if (verification_status) {
            // Update Redux immediately
            dispatch(setVerificationStatus(verification_status));

            // Optionally refetch full profile to ensure consistency
            fetchAndSetUserProfile().catch((error) => {
              logger.error("[VerificationListener] Failed to refetch profile:", error);
            });

            logger.log(`[VerificationListener] Updated verification_status to: ${verification_status}`);
          }
        })
        .subscribe((status) => {
          logger.log(`[VerificationListener] Channel subscription status: ${status}`);
        });
    } catch (error) {
      logger.error("[VerificationListener] Error setting up channel:", error);
    }

    // Cleanup on unmount
    return () => {
      if (channel) {
        logger.log(`[VerificationListener] Unsubscribing from channel: ${channelName}`);
        supabase.removeChannel(channel).catch((error) => {
          logger.error("[VerificationListener] Error removing channel:", error);
        });
      }
    };
  }, [userId, dispatch]);
}
