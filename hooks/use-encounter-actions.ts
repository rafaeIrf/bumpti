import { useDatabase } from "@/components/DatabaseProvider";
import { useDiscoverySwipes } from "@/hooks/use-discovery-swipes";
import DiscoveryProfile from "@/modules/database/models/DiscoveryProfile";
import type { SwipeAction } from "@/modules/database/models/SwipeQueue";
import type { DiscoverEncounter } from "@/modules/discover/types";
import { skipEncounters } from "@/modules/discovery/api";
import { removeDiscoveryProfile } from "@/modules/discovery/discovery-service";
import { interactUser } from "@/modules/interactions/api";
import { logger } from "@/utils/logger";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";

type MatchInfo = {
  userId: string;
  name: string;
  photoUrl: string | null;
};

// Module-level Set to track user IDs acted upon (liked/skipped) from ANY screen.
// The Discover screen consumes these on focus to filter cards out of the feed.
const actedUserIds = new Set<string>();

// Module-level store for pending match info.
// Used to pass match data from profile-preview back to the Discover screen.
let pendingMatchInfo: MatchInfo | null = null;

// Cache of profile data keyed by userId, populated before queueSwipe deletes the record.
// Used by the onMatch callback to show the modal for deferred matches.
const matchProfileCache = new Map<string, { name: string; photoUrl: string | null }>();

/** Consume and clear acted user IDs. Call on Discover screen focus. */
export function consumeActedUserIds(): Set<string> {
  const copy = new Set(actedUserIds);
  actedUserIds.clear();
  return copy;
}

/** Consume pending match info. Call on Discover screen focus or effect. */
export function consumePendingMatch(): MatchInfo | null {
  const info = pendingMatchInfo;
  pendingMatchInfo = null;
  return info;
}

export function useEncounterActions() {
  const database = useDatabase();
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const processingRef = useRef(new Set<string>());

  const { queueSwipe } = useDiscoverySwipes(undefined, {
    onMatch: (targetUserId: string) => {
      // If this match was already shown as instant match, skip
      if (pendingMatchInfo?.userId === targetUserId) return;

      // Deferred match from batch flush
      const cached = matchProfileCache.get(targetUserId);
      matchProfileCache.delete(targetUserId);
      const info: MatchInfo = {
        userId: targetUserId,
        name: cached?.name ?? "",
        photoUrl: cached?.photoUrl ?? null,
      };
      setMatchInfo(info);
      pendingMatchInfo = info;
    },
  });

  const handleLike = useCallback(
    async (encounter: DiscoverEncounter) => {
      const userId = encounter.other_user_id;
      if (processingRef.current.has(userId)) return;
      processingRef.current.add(userId);

      try {
        actedUserIds.add(userId);

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        // Read hydrated profile from WatermelonDB BEFORE queueSwipe deletes it
        let cachedName: string | null = null;
        let cachedPhotoUrl: string | null = null;
        try {
          const collection = database.collections.get<DiscoveryProfile>(
            "discovery_profiles"
          );
          const record = await collection.find(userId);
          const data = record.data;
          if (data) {
            cachedName = data.name ?? null;
            cachedPhotoUrl = data.photos?.[0] ?? null;
          }
        } catch {
          // Record may not exist — use encounter fallback
        }

        const resolvedName = cachedName ?? encounter.other_name ?? "";
        const resolvedPhoto = cachedPhotoUrl ?? encounter.other_photos?.[0] ?? null;

        // Cache profile data for the onMatch callback (deferred matches)
        matchProfileCache.set(userId, { name: resolvedName, photoUrl: resolvedPhoto });

        if (encounter.encounter_type === "shared_favorites") {
          // shared_favorites have no placeId — bypass swipe queue, call interact-user directly.
          // Remove from local cache immediately (UI doesn't block), then fire API call.
          await removeDiscoveryProfile({ database, userId });
          interactUser({
            toUserId: userId,
            action: "like",
            placeId: encounter.place_id || undefined,
          }).then((result) => {
            if (result.status === "liked" && result.match) {
              const info: MatchInfo = {
                userId,
                name: resolvedName,
                photoUrl: resolvedPhoto,
              };
              setMatchInfo(info);
              pendingMatchInfo = info;
              matchProfileCache.delete(userId);
            }
          }).catch((err) => {
            logger.error("interactUser like (shared_favorites) failed", { err });
          });
        } else {
          const result = await queueSwipe({
            targetUserId: userId,
            action: "like" as SwipeAction,
            placeIdOverride: encounter.place_id,
          });
          // queueSwipe already removes from discovery_profiles locally
          // interact-user Edge Function now also deletes from user_encounters

          if (result?.instantMatch) {
            // Instant match detected via local likerIds — show modal immediately
            const info: MatchInfo = {
              userId,
              name: resolvedName,
              photoUrl: resolvedPhoto,
            };
            setMatchInfo(info);
            pendingMatchInfo = info;
            matchProfileCache.delete(userId);
          }
        }
      } catch (error) {
        logger.error("handleLike failed", { userId, error });
      } finally {
        processingRef.current.delete(userId);
      }
    },
    [database, queueSwipe]
  );

  const handleSkip = useCallback(
    async (encounter: DiscoverEncounter) => {
      const userId = encounter.other_user_id;
      if (processingRef.current.has(userId)) return;
      processingRef.current.add(userId);

      try {
        actedUserIds.add(userId);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // 1. Permanently remove from local WatermelonDB cache
        await removeDiscoveryProfile({ database, userId });

        // 2. Server-side: shared_favorites have no encounter row,
        //    so we record a dislike instead of skipping an encounter.
        if (encounter.encounter_type === "shared_favorites") {
          interactUser({
            toUserId: userId,
            action: "dislike",
            placeId: encounter.place_id ?? undefined,
          });
        } else {
          skipEncounters({ otherUserIds: [userId] });
        }
      } catch (error) {
        logger.error("handleSkip failed", { userId, error });
      } finally {
        processingRef.current.delete(userId);
      }
    },
    [database]
  );

  const clearMatch = useCallback(() => {
    setMatchInfo(null);
    pendingMatchInfo = null;
  }, []);

  return {
    handleLike,
    handleSkip,
    matchInfo,
    setMatchInfo,
    clearMatch,
  } as const;
}
