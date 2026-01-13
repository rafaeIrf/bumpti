import { useDatabase } from "@/components/DatabaseProvider";
import {
  enqueueSwipe,
  type SwipeBatchResult,
} from "@/modules/discovery/swipe-queue-service";
import type { SwipeAction } from "@/modules/database/models/SwipeQueue";
import { hasLikerId, removeLikerId } from "@/modules/discovery/liker-ids-service";
import { flushSwipeQueueNow } from "@/modules/discovery/swipe-queue-orchestrator";
import { logger } from "@/utils/logger";
import { AppState } from "react-native";
import { useCallback, useEffect, useRef } from "react";

const FLUSH_DELAY_MS = 2000;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 30000;

export function useDiscoverySwipes(
  placeId?: string,
  options: { onMatch?: (targetUserId: string) => void } = {}
) {
  const { onMatch } = options;
  const database = useDatabase();
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const backoffRef = useRef(BACKOFF_BASE_MS);
  const flushNowRef = useRef<() => Promise<SwipeBatchResult[]>>(
    async () => []
  );
  const suppressedMatchIdsRef = useRef(new Set<string>());

  const clearFlushTimer = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const flushNow = useCallback(async (): Promise<SwipeBatchResult[]> => {
    if (isFlushingRef.current) return [];
    isFlushingRef.current = true;

    try {
      const results = await flushSwipeQueueNow({ database, reason: "local" });
      if (onMatch) {
        results.forEach((result) => {
          if (!result.is_match || result.status !== "ok") return;
          if (suppressedMatchIdsRef.current.has(result.target_user_id)) {
            suppressedMatchIdsRef.current.delete(result.target_user_id);
            return;
          }
          onMatch(result.target_user_id);
        });
      }
      backoffRef.current = BACKOFF_BASE_MS;
      clearRetryTimer();
      return results;
    } catch (error) {
      logger.warn("Swipe queue flush failed, scheduling retry", { error });
      clearRetryTimer();
      const delay = backoffRef.current;
      retryTimeoutRef.current = setTimeout(() => {
        void flushNowRef.current();
      }, delay);
      backoffRef.current = Math.min(backoffRef.current * 2, BACKOFF_MAX_MS);
      return [];
    } finally {
      isFlushingRef.current = false;
    }
  }, [clearRetryTimer, database]);

  useEffect(() => {
    flushNowRef.current = flushNow;
  }, [flushNow]);

  const scheduleFlush = useCallback(() => {
    clearFlushTimer();
    flushTimeoutRef.current = setTimeout(() => {
      void flushNow();
    }, FLUSH_DELAY_MS);
  }, [clearFlushTimer, flushNow]);

  const queueSwipe = useCallback(
    async (params: {
      targetUserId: string;
      action: SwipeAction;
      placeIdOverride?: string;
    }) => {
      const { targetUserId, action, placeIdOverride } = params;
      const resolvedPlaceId = placeIdOverride ?? placeId;
      if (!resolvedPlaceId) return { results: [], instantMatch: false };

      const isInstantMatch =
        action === "like" &&
        (await hasLikerId({ database, id: targetUserId }));

      if (isInstantMatch) {
        suppressedMatchIdsRef.current.add(targetUserId);
        await removeLikerId({ database, id: targetUserId });
      }

      await enqueueSwipe({
        database,
        targetUserId,
        action,
        placeId: resolvedPlaceId,
        removeProfileId: targetUserId,
      });

      if (isInstantMatch) {
        void flushNow();
        return { results: [], instantMatch: true };
      }

      scheduleFlush();
      return { results: [], instantMatch: false };
    },
    [database, flushNow, placeId, scheduleFlush]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        void flushNow();
      }
    });

    return () => {
      void flushNowRef.current();
      subscription.remove();
      clearFlushTimer();
      clearRetryTimer();
    };
  }, [clearFlushTimer, clearRetryTimer, flushNow]);

  return {
    queueSwipe,
    flushNow,
  } as const;
}
