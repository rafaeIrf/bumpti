import type { AppDispatch } from "@/modules/store";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { pendingLikesApi } from "./pendingLikesApi";

/**
 * Attach realtime listener for pending likes
 * Invalidates RTK Query cache when new likes arrive
 */
export function attachPendingLikesRealtime(
  dispatch: AppDispatch,
  userId: string
): RealtimeChannel {
  const channel = supabase
    .channel(`pending-likes:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "user_interactions",
        filter: `to_user_id=eq.${userId}`,
      },
      (payload) => {
        logger.log("New interaction received:", payload);
        // Only invalidate on 'like' actions
        if (payload.new && (payload.new as any).action === "like") {
          dispatch(
            pendingLikesApi.util.invalidateTags([
              { type: "PendingLikes", id: "LIST" },
            ])
          );
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "user_matches",
        filter: `user_a=eq.${userId}`,
      },
      () => {
        dispatch(
          pendingLikesApi.util.invalidateTags([
            { type: "PendingLikes", id: "LIST" },
          ])
        );
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "user_matches",
        filter: `user_b=eq.${userId}`,
      },
      () => {
        dispatch(
          pendingLikesApi.util.invalidateTags([
            { type: "PendingLikes", id: "LIST" },
          ])
        );
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_interactions",
        filter: `to_user_id=eq.${userId}`,
      },
      () => {
        dispatch(
          pendingLikesApi.util.invalidateTags([
            { type: "PendingLikes", id: "LIST" },
          ])
        );
      }
    )
    .subscribe((status) => {
      logger.log("Pending likes subscription status:", status);
    });

  return channel;
}
