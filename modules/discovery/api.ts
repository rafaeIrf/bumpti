import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";

/**
 * Calls skip-encounter Edge Function to permanently delete
 * user_encounters rows for the given other user IDs.
 *
 * Fire-and-forget safe — failures are logged but don't throw.
 */
export async function skipEncounters(params: {
  otherUserIds: string[];
}): Promise<void> {
  const { otherUserIds } = params;
  if (otherUserIds.length === 0) return;

  try {
    const { error } = await supabase.functions.invoke("skip-encounter", {
      body: { other_user_ids: otherUserIds },
    });

    if (error) {
      logger.error("[skipEncounters] Edge Function error:", error);
    }
  } catch (err) {
    logger.error("[skipEncounters] Unexpected error:", err);
  }
}
