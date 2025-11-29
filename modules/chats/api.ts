import { supabase } from "@/modules/supabase/client";
import { extractEdgeErrorMessage } from "@/modules/supabase/edge-error";

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ChatSummary = {
  chat_id: string;
  match_id: string;
  other_user: {
    id: string;
    name: string | null;
    bio: string | null;
  };
  last_message: Message | null;
  created_at: string;
  matched_at: string | null;
};

export type GetChatsResponse = { chats: ChatSummary[] };
export type GetMessagesResponse = { chat_id: string; messages: Message[] };
export type MatchSummary = {
  match_id: string;
  user_id: string;
  name: string | null;
  photo_url: string | null;
  match_created_at: string | null;
};
export type GetMatchesResponse = { matches: MatchSummary[] };

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
      (payload) => {
        const message = payload.new as Message;
        onMessage(message);
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

export async function getChats(): Promise<GetChatsResponse> {
  const { data, error } = await supabase.functions.invoke<GetChatsResponse>(
    "get-chats"
  );

  if (error) {
    const message = await extractEdgeErrorMessage(error, "Failed to load chats.");
    throw new Error(message || "Failed to load chats.");
  }

  return data ?? { chats: [] };
}

export async function getMessages(params: {
  chatId: string;
  limit?: number;
  before?: string;
}): Promise<GetMessagesResponse> {
  const { chatId, limit, before } = params;

  const { data, error } = await supabase.functions.invoke<GetMessagesResponse>(
    "get-messages",
    {
      body: {
        chat_id: chatId,
        ...(typeof limit === "number" ? { limit } : {}),
        ...(before ? { before } : {}),
      },
    }
  );

  if (error) {
    const message = await extractEdgeErrorMessage(
      error,
      "Failed to load messages."
    );
    throw new Error(message || "Failed to load messages.");
  }

  if (!data) {
    throw new Error("No response from get-messages.");
  }

  return data;
}

export async function sendMessage(params: {
  toUserId: string;
  content: string;
}): Promise<{
  status: string;
  chat_id: string;
  message: Message;
}> {
  const { toUserId, content } = params;

  const { data, error } = await supabase.functions.invoke<{
    status: string;
    chat_id: string;
    message: Message;
  }>("send-message", {
    body: { to_user_id: toUserId, content },
  });

  if (error) {
    const message = await extractEdgeErrorMessage(
      error,
      "Failed to send message."
    );
    throw new Error(message || "Failed to send message.");
  }

  if (!data) {
    throw new Error("No response from send-message.");
  }

  return data;
}

export async function getMatches(): Promise<GetMatchesResponse> {
  const { data, error } = await supabase.functions.invoke<GetMatchesResponse>(
    "get-matches"
  );
  console.log("getMatches data:", data);

  if (error) {
    const message = await extractEdgeErrorMessage(
      error,
      "Failed to load matches."
    );
    throw new Error(message || "Failed to load matches.");
  }

  return data ?? { matches: [] };
}
