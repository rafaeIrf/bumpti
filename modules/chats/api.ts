import { supabase } from "@/modules/supabase/client";
import { extractEdgeErrorMessage } from "@/modules/supabase/edge-error";
import { logger } from "@/utils/logger";

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export async function markMessagesRead(params: {
  chatId: string;
}): Promise<{ updated_messages: number }> {
  const { chatId } = params;
  const { data, error } = await supabase.functions.invoke<{
    updated_messages: number;
  }>("mark-messages-read", {
    body: { chat_id: chatId },
  });
  logger.debug("markMessagesRead data", { data });

  if (error) {
    const message = await extractEdgeErrorMessage(
      error,
      "Failed to mark messages as read."
    );
    throw new Error(message || "Failed to mark messages as read.");
  }

  if (!data) {
    throw new Error("No response from mark-messages-read.");
  }

  return data;
}

export async function updateMatch(params: {
  matchId: string;
  status?: "active" | "unmatched";
  markOpened?: boolean;
}): Promise<{ match: any }> {
  const { matchId, status, markOpened } = params;

  const { data, error } = await supabase.functions.invoke<{
    match: {
      id: string;
      user_a: string;
      user_b: string;
      status: string;
      matched_at?: string | null;
      unmatched_at?: string | null;
      user_a_opened_at?: string | null;
      user_b_opened_at?: string | null;
      place_id?: string | null;
    };
  }>("update-match", {
    body: {
      match_id: matchId,
      ...(status ? { status } : {}),
      ...(markOpened ? { mark_opened: true } : {}),
    },
  });

  if (error) {
    const message = await extractEdgeErrorMessage(
      error,
      "Failed to update match."
    );
    throw new Error(message || "Failed to update match.");
  }

  if (!data?.match) {
    throw new Error("No match returned from update-match.");
  }

  return { match: data.match };
}
