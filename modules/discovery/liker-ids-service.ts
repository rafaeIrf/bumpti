import type LikerId from "@/modules/database/models/LikerId";
import type { Database } from "@nozbe/watermelondb";
import { Q } from "@nozbe/watermelondb";

export async function upsertLikerIds(params: {
  database: Database;
  ids: string[];
}): Promise<void> {
  const { database, ids } = params;
  const collection = database.collections.get<LikerId>("liker_ids");

  await database.write(async () => {
    const batch = [];

    for (const id of ids) {
      if (!id) continue;
      try {
        await collection.find(id);
      } catch {
        batch.push(
          collection.prepareCreate((record) => {
            record._raw.id = id;
          })
        );
      }
    }

    if (batch.length > 0) {
      await database.batch(...batch);
    }
  });
}

export async function hasLikerId(params: {
  database: Database;
  id: string;
}): Promise<boolean> {
  const { database, id } = params;
  const collection = database.collections.get<LikerId>("liker_ids");
  try {
    await collection.find(id);
    return true;
  } catch {
    return false;
  }
}

export async function removeLikerId(params: {
  database: Database;
  id: string;
}): Promise<void> {
  const { database, id } = params;
  const collection = database.collections.get<LikerId>("liker_ids");
  try {
    const record = await collection.find(id);
    await database.write(async () => {
      await record.destroyPermanently();
    });
  } catch {
    // no-op if not found
  }
}

export async function listLikerIds(params: {
  database: Database;
}): Promise<string[]> {
  const { database } = params;
  const collection = database.collections.get<LikerId>("liker_ids");
  const records = await collection.query(Q.all()).fetch();
  return records.map((record) => record.id);
}

export async function clearLikerIds(params: {
  database: Database;
}): Promise<void> {
  const { database } = params;
  const collection = database.collections.get<LikerId>("liker_ids");
  const records = await collection.query(Q.all()).fetch();
  if (records.length === 0) return;

  await database.write(async () => {
    const batch = records.map((record) => record.prepareDestroyPermanently());
    await database.batch(...batch);
  });
}
