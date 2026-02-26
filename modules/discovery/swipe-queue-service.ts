import type DiscoveryProfile from "@/modules/database/models/DiscoveryProfile";
import type SwipeQueue from "@/modules/database/models/SwipeQueue";
import type { SwipeAction } from "@/modules/database/models/SwipeQueue";
import { removeDiscoveryProfiles } from "@/modules/discovery/discovery-service";
import { interactUsersBatch } from "@/modules/interactions/api";
import { logger } from "@/utils/logger";
import type { PresenceEntryType } from "@/utils/presence-badge";
import type { Database } from "@nozbe/watermelondb";
import { Q } from "@nozbe/watermelondb";

export type SwipeQueueItem = {
  id: string;
  targetUserId: string;
  action: SwipeAction;
  placeId: string;
  /**
   * Raw entry_type of the swiped user. Forwarded as match_origin_override
   * on flush so the backend maps it to the correct match_origin.
   */
  context?: PresenceEntryType | null;
  createdAt: Date;
};

export type SwipeBatchResult = {
  target_user_id: string;
  action: SwipeAction;
  status: "ok" | "error";
  is_match?: boolean;
  match_id?: string | null;
  error?: string;
};

export async function enqueueSwipe(params: {
  database: Database;
  targetUserId: string;
  action: SwipeAction;
  placeId: string;
  /**
   * Raw entry_type of the swiped user.
   * Persisted in swipes_queue.context and forwarded on batch flush.
   */
  context?: PresenceEntryType | null;
  removeProfileId?: string;
}): Promise<void> {
  const { database, targetUserId, action, placeId, context, removeProfileId } = params;
  const collection = database.collections.get<SwipeQueue>("swipes_queue");
  const discoveryCollection = database.collections.get<DiscoveryProfile>(
    "discovery_profiles"
  );
  await database.write(async () => {
    const batch: any[] = [];
    const existing = await collection
      .query(Q.where("target_user_id", targetUserId))
      .fetch();

    if (existing.length > 0) {
      const record = existing[0];
      batch.push(
        record.prepareUpdate((swipe) => {
          swipe.action = action;
          swipe.placeId = placeId;
          swipe.context = context ?? null;
        })
      );
    } else {
      batch.push(
        collection.prepareCreate((record) => {
          record.targetUserId = targetUserId;
          record.action = action;
          record.placeId = placeId;
          record.context = context ?? null;
        })
      );
    }

    if (removeProfileId) {
      try {
        const profile = await discoveryCollection.find(removeProfileId);
        batch.push(profile.prepareDestroyPermanently());
      } catch {
        // no-op if not found
      }
    }

    if (batch.length > 0) {
      await database.batch(...batch);
    }
  });
}

export async function getQueuedSwipes(params: {
  database: Database;
}): Promise<SwipeQueueItem[]> {
  const { database } = params;
  const collection = database.collections.get<SwipeQueue>("swipes_queue");
  const records = await collection
    .query(Q.sortBy("created_at", Q.asc))
    .fetch();

  return records.map((record) => ({
    id: record.id,
    targetUserId: record.targetUserId,
    action: record.action,
    placeId: record.placeId,
    context: record.context ?? null,
    createdAt: record.createdAt,
  }));
}

export async function removeQueuedSwipes(params: {
  database: Database;
  targetUserIds: string[];
}): Promise<void> {
  const { database, targetUserIds } = params;
  if (targetUserIds.length === 0) return;

  const collection = database.collections.get<SwipeQueue>("swipes_queue");

  await database.write(async () => {
    const records = await collection
      .query(Q.where("target_user_id", Q.oneOf(targetUserIds)))
      .fetch();
    const batch = records.map((record) => record.prepareDestroyPermanently());
    if (batch.length > 0) {
      await database.batch(...batch);
    }
  });
}

export async function flushQueuedSwipes(params: {
  database: Database;
}): Promise<SwipeBatchResult[]> {
  const { database } = params;
  const queued = await getQueuedSwipes({ database });
  if (queued.length === 0) return [];

  try {
    const results = await interactUsersBatch({
      batch: queued.map((item) => ({
        to_user_id: item.targetUserId,
        action: item.action,
        place_id: item.placeId,
        // Forward regular context so the DB trigger sets match_origin correctly
        ...(item.context ? { match_origin_override: item.context } : {}),
      })),
    });

    const okIds = new Set(
      results
        .filter((result) => result.status === "ok")
        .map((result) => result.target_user_id)
    );

    const idsToRemove = queued
      .filter((item) => okIds.has(item.targetUserId))
      .map((item) => item.targetUserId);

    await removeQueuedSwipes({ database, targetUserIds: idsToRemove });
    await removeDiscoveryProfiles({ database, userIds: idsToRemove });
    if (idsToRemove.length > 0) {
      logger.info("Removed swiped profiles after flush", {
        count: idsToRemove.length,
      });
    }
    return results;
  } catch (error) {
    logger.error("Failed to flush swipe queue", { error });
    throw error;
  }
}
