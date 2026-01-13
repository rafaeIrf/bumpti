import { flushQueuedSwipes, type SwipeBatchResult } from "@/modules/discovery/swipe-queue-service";
import { logger } from "@/utils/logger";
import type { Database } from "@nozbe/watermelondb";

let flushPromise: Promise<SwipeBatchResult[]> | null = null;

export async function flushSwipeQueueNow(params: {
  database: Database;
  reason: "app-start" | "foreground" | "local" | "manual";
}): Promise<SwipeBatchResult[]> {
  if (flushPromise) return flushPromise;

  const { database, reason } = params;
  flushPromise = (async () => {
    try {
      logger.info("Checking for orphaned swipes in queue...", { reason });
      return await flushQueuedSwipes({ database });
    } catch (error) {
      logger.warn("Swipe queue flush failed", { reason, error });
      return [];
    } finally {
      flushPromise = null;
    }
  })();

  return flushPromise;
}
