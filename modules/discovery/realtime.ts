import type LikerId from "@/modules/database/models/LikerId";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import type { Database } from "@nozbe/watermelondb";
import type { RealtimeChannel } from "@supabase/supabase-js";

function registerLikerIdsRealtime(params: {
  channel: RealtimeChannel;
  database: Database;
  userId: string;
}): void {
  const { channel, database, userId } = params;
  const collection = database.collections.get<LikerId>("liker_ids");

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "user_interactions",
      filter: `to_user_id=eq.${userId}`,
    },
    async (payload) => {
      if ((payload.new as any)?.action !== "like") return;
      const fromUserId = (payload.new as any)?.from_user_id;
      if (!fromUserId) return;

      try {
        await database.write(async () => {
          try {
            await collection.find(fromUserId);
          } catch {
            await collection.create((record) => {
              record._raw.id = fromUserId;
            });
          }
        });
      } catch (error) {
        logger.error("Failed to upsert liker_id from realtime", { error });
      }
    }
  );
}

function registerMatchRealtime(params: {
  channel: RealtimeChannel;
  onNewMatch: (payload: any) => Promise<void>;
}): void {
  const { channel, onNewMatch } = params;

  channel.on("broadcast", { event: "NEW_MATCH" }, async (payload) => {
    try {
      await onNewMatch(payload?.payload);
    } catch (error) {
      logger.error("Failed to handle NEW_MATCH broadcast", { error });
    }
  });
}

export function attachLikerIdsRealtime(params: {
  database: Database;
  userId: string;
}): RealtimeChannel {
  const { database, userId } = params;
  const channel = supabase.channel(`liker-ids:${userId}`);

  registerLikerIdsRealtime({ channel, database, userId });

  channel.subscribe((status) => {
    logger.log("Liker IDs subscription status:", status);
  });

  return channel;
}

export function attachMatchRealtime(params: {
  userId: string;
  onNewMatch: (payload: any) => Promise<void>;
}): RealtimeChannel {
  const { userId, onNewMatch } = params;
  const channel = supabase.channel(`user:${userId}`);

  registerMatchRealtime({ channel, onNewMatch });

  channel.subscribe((status) => {
    logger.log("Match subscription status:", status);
  });

  return channel;
}
