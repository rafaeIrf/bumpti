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
  place_id: string | null;
  chat_created_at: string | null;
  other_user: {
    id: string;
    name: string | null;
    photo_url?: string | null;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count?: number;
};

export type GetChatsResponse = { chats: ChatSummary[] };
export type GetMessagesResponse = { chat_id: string; messages: Message[] };
export type MatchSummary = {
  match_id: string;
  chat_id: string | null;
  matched_at: string | null;
  place_id: string | null;
  is_new_match: boolean;
  other_user: {
    id: string;
    name: string | null;
    photo_url: string | null;
  };
};
export type GetMatchesResponse = { matches: MatchSummary[] };

export async function getChats(): Promise<GetChatsResponse> {
  const { data, error } = await supabase.functions.invoke<{
    chats: {
      chat_id: string;
      match_id: string;
      place_id: string | null;
      chat_created_at?: string | null;
      other_user_id: string;
      other_user_name: string | null;
      other_user_photo_url: string | null;
      last_message: string | null;
      last_message_at: string | null;
      unread_count: number | null;
    }[];
  }>("get-chats");

  if (error) {
    const message = await extractEdgeErrorMessage(error, "Failed to load chats.");
    throw new Error(message || "Failed to load chats.");
  }

  const chats =
    data?.chats?.map((c) => ({
      chat_id: c.chat_id,
      match_id: c.match_id,
      place_id: c.place_id ?? null,
      chat_created_at: c.chat_created_at ?? null,
      other_user: {
        id: c.other_user_id,
        name: c.other_user_name,
        photo_url: c.other_user_photo_url ?? null,
      },
      last_message: c.last_message ?? null,
      last_message_at: c.last_message_at ?? null,
      unread_count: c.unread_count ?? 0,
    })) ?? [];

  return { chats };
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
