import { Message } from "@/modules/chats/api";
import { supabase } from "@/modules/supabase/client";
import type { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

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
        onUpdate({ type: "message", message: payload.new });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
      },
      (payload: RealtimePostgresUpdatePayload<Message>) => {
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
 * Listen to inserts on messages for a specific chat.
 * Returns unsubscribe function.
 */
export function subscribeToChatMessages(
  chatId: string,
  onMessage: (message: Message) => void
): () => Promise<"ok" | "error" | "timed_out"> {
  if (!chatId) {
    throw new Error("chatId is required to subscribe to messages.");
  }

  const channel = supabase
    .channel(`messages-chat-${chatId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload: RealtimePostgresInsertPayload<Message>) => {
        onMessage(payload.new);
      }
    )
    .subscribe();

  return async () => {
    const result = await supabase.removeChannel(channel);
    // Map "timed out" to "timed_out" for type compatibility
    if (result === "timed out") return "timed_out";
    return result as "ok" | "error" | "timed_out";
  };
}
