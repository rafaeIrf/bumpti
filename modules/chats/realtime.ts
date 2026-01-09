import { Message } from "@/modules/chats/api";
import { supabase } from "@/modules/supabase/client";
import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";

export type MatchOverviewChange = { type: "refetch" };
export type ChatListMessageEvent = { type: "message"; message: Message };
export type ChatListRefetchEvent = { type: "refetch" };
export type ChatListChange = ChatListMessageEvent | ChatListRefetchEvent;

/**
 * Listen to inserts on user_matches and messages.
 * RLS ensures the current user only receives relevant events.
 */
export function subscribeToMatchOverview(
  onChange: (event: MatchOverviewChange) => void
) {
  const channel = supabase
    .channel(`match-overview-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "user_matches" },
      () => onChange({ type: "refetch" })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "chats" },
      (payload: RealtimePostgresUpdatePayload<Message>) => {
        onChange({ type: "refetch" })
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_matches",
      },
      (payload) => {
        const newMatch = payload.new
        if (newMatch.status === "unmatched" || newMatch.user_a_opened_at !== null || newMatch.user_b_opened_at !== null) {
          onChange({ type: "refetch" });
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Listen to inserts on messages to refresh chat list.
 * RLS filters messages for the authenticated user.
 */
export function subscribeToChatList(onUpdate: (event: ChatListMessageEvent) => void) {
  const channel = supabase
    .channel(`chat-list-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload: RealtimePostgresInsertPayload<Message>) => {
        // TODO: Verificar se é disparado quando outros usuarios trocam mensagens
        onUpdate({ type: "message", message: payload.new });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_matches",
      },
      (payload) => {
        const newMatch = payload.new;
        if (
          newMatch?.status === "unmatched"
        ) {
          onUpdate({ type: "refetch" } as any);
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Listen to chat messages via broadcast channel (send-and-broadcast).
 * The backend (push-changes) broadcasts plaintext payload after persisting.
 */
export function subscribeToUserMessages(
  userId: string,
  onMessage: (message: Message) => void,
  currentUserId?: string
): () => Promise<"ok" | "error" | "timed_out"> {
  if (!userId) {
    throw new Error("userId is required to subscribe to messages.");
  }

  const channel: RealtimeChannel = supabase
    .channel(`user:${userId}`)
    .on("broadcast", { event: "new_message" }, (payload) => {
      const message = payload?.payload as Message | undefined;
      if (message) {
        // Ignore own messages to avoid duplication (already have via optimistic + sync)
        if (currentUserId && message.sender_id === currentUserId) {
          return;
        }
        onMessage(message);
      }
    })
    .subscribe();

  return async () => {
    const result = await supabase.removeChannel(channel);
    if (result === "timed out") return "timed_out";
    return result as "ok" | "error" | "timed_out";
  };
}
