import { supabase } from "@/modules/supabase/client";

export type InteractionAction = "like" | "dislike";

export type InteractionResponse =
  | { status: "liked"; match: boolean; match_id: string | null }
  | { status: "disliked" };

export type UnmatchResponse = { status: "unmatched"; match_id: string };

export async function interactUser(params: {
  toUserId: string;
  action: InteractionAction;
}): Promise<InteractionResponse> {
  const { toUserId, action } = params;

  try {
    const { data, error } = await supabase.functions.invoke<InteractionResponse>(
      "interact-user",
      {
        body: { to_user_id: toUserId, action },
      }
    );

    if (error) {
      console.error("interactUser (edge) error:", error);
      throw new Error(error.message || "Failed to interact with user.");
    }

    if (!data) {
      throw new Error("No response from interact-user.");
    }

    return data;
  } catch (err) {
    console.error("interactUser (api) error:", err);
    throw err instanceof Error
      ? err
      : new Error("Unexpected error interacting with user.");
  }
}

export async function unmatchUser(userId: string): Promise<UnmatchResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<UnmatchResponse>(
      "unmatch-user",
      {
        body: { user_id: userId },
      }
    );

    if (error) {
      console.error("unmatchUser (edge) error:", error);
      throw new Error(error.message || "Failed to unmatch user.");
    }

    if (!data) {
      throw new Error("No response from unmatch-user.");
    }

    return data;
  } catch (err) {
    console.error("unmatchUser (api) error:", err);
    throw err instanceof Error ? err : new Error("Unexpected error unmatching.");
  }
}
