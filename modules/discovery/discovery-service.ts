import type DiscoveryProfile from "@/modules/database/models/DiscoveryProfile";
import { logger } from "@/utils/logger";
import type { Database } from "@nozbe/watermelondb";
import { Q } from "@nozbe/watermelondb";
import type { ActiveUserAtPlace } from "@/modules/presence/api";
import { getActiveUsersAtPlace } from "@/modules/presence/api";
import {
  clearLikerIds,
  upsertLikerIds,
} from "@/modules/discovery/liker-ids-service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LIKER_IDS_LAST_FETCH_KEY = "liker_ids_last_fetched_at";
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

export async function upsertDiscoveryProfiles(params: {
  database: Database;
  placeId: string;
  users: ActiveUserAtPlace[];
}): Promise<void> {
  const { database, placeId, users } = params;
  const collection = database.collections.get<DiscoveryProfile>(
    "discovery_profiles"
  );
  const now = new Date();

  await database.write(async () => {
    const batch = [];

    for (const user of users) {
      const recordId = user.user_id;
      if (!recordId) {
        continue;
      }

      try {
        const existing = await collection.find(recordId);
        batch.push(
          existing.prepareUpdate((record) => {
            record.rawData = JSON.stringify(user);
            record.placeId = placeId;
            record.lastFetchedAt = now;
          })
        );
      } catch {
        batch.push(
          collection.prepareCreate((record) => {
            record._raw.id = recordId;
            record.rawData = JSON.stringify(user);
            record.placeId = placeId;
            record.lastFetchedAt = now;
          })
        );
      }
    }

    if (batch.length > 0) {
      await database.batch(...batch);
    }
  });
}

export async function fetchDiscoveryFeed(params: {
  database: Database;
  placeId: string;
}): Promise<ActiveUserAtPlace[]> {
  const { database, placeId } = params;

  try {
    await cleanupStaleDiscoveryProfiles({ database });
    await cleanupStaleLikerIds({ database });

    const response = await getActiveUsersAtPlace(placeId);
    const users = response?.users ?? [];
    const likerIds = response?.liker_ids ?? [];
    await upsertDiscoveryProfiles({ database, placeId, users });
    await upsertLikerIds({ database, ids: likerIds });
    await AsyncStorage.setItem(
      LIKER_IDS_LAST_FETCH_KEY,
      String(Date.now())
    );
    return users;
  } catch (error) {
    logger.error("Failed to fetch discovery feed", { placeId, error });
    return [];
  }
}

export async function removeDiscoveryProfile(params: {
  database: Database;
  userId: string;
}): Promise<void> {
  const { database, userId } = params;
  const collection = database.collections.get<DiscoveryProfile>(
    "discovery_profiles"
  );
  try {
    const record = await collection.find(userId);
    await database.write(async () => {
      await record.destroyPermanently();
    });
  } catch {
    // no-op if not found
  }
}

async function cleanupStaleDiscoveryProfiles(params: {
  database: Database;
}): Promise<void> {
  const { database } = params;
  const cutoff = Date.now() - STALE_TTL_MS;
  const collection = database.collections.get<DiscoveryProfile>(
    "discovery_profiles"
  );
  const stale = await collection
    .query(Q.where("last_fetched_at", Q.lt(cutoff)))
    .fetch();
  if (stale.length === 0) return;

  await database.write(async () => {
    const batch = stale.map((record) => record.prepareDestroyPermanently());
    await database.batch(...batch);
  });
}

async function cleanupStaleLikerIds(params: {
  database: Database;
}): Promise<void> {
  const { database } = params;
  try {
    const lastFetched = await AsyncStorage.getItem(LIKER_IDS_LAST_FETCH_KEY);
    if (lastFetched) {
      const lastFetchedAt = Number(lastFetched);
      if (!Number.isNaN(lastFetchedAt)) {
        const isStale = Date.now() - lastFetchedAt > STALE_TTL_MS;
        if (!isStale) return;
      }
    }
    await clearLikerIds({ database });
  } catch (error) {
    logger.warn("Failed to cleanup stale liker ids", { error });
  }
}

export async function getDiscoveryProfilesForPlace(params: {
  database: Database;
  placeId: string;
}): Promise<DiscoveryProfile[]> {
  const { database, placeId } = params;
  const collection = database.collections.get<DiscoveryProfile>(
    "discovery_profiles"
  );
  return collection
    .query(Q.where("place_id", placeId))
    .fetch();
}
