import type SwipeQueue from "@/modules/database/models/SwipeQueue";
import type { SwipeAction } from "@/modules/database/models/SwipeQueue";
import type { Database } from "@nozbe/watermelondb";
import { Q } from "@nozbe/watermelondb";
import { logger } from "@/utils/logger";
import { interactUsersBatch } from "@/modules/interactions/api";

export type SwipeQueueItem = {
  id: string;
  targetUserId: string;
  action: SwipeAction;
  placeId: string;
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
}): Promise<void> {
  const { database, targetUserId, action, placeId } = params;
  const collection = database.collections.get<SwipeQueue>("swipes_queue");
  const now = new Date();

  await database.write(async () => {
    const existing = await collection
      .query(Q.where("target_user_id", targetUserId))
      .fetch();

    if (existing.length > 0) {
      const record = existing[0];
      await record.update((swipe) => {
        swipe.action = action;
        swipe.placeId = placeId;
      });
      return;
    }

    await collection.create((record) => {
      record.targetUserId = targetUserId;
      record.action = action;
      record.placeId = placeId;
    });
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
    return results;
  } catch (error) {
    logger.error("Failed to flush swipe queue", { error });
    throw error;
  }
}
