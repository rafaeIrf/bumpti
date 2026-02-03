import { trackMatch } from "@/modules/analytics";
import { supabase } from "@/modules/supabase/client";
import { extractEdgeErrorMessage } from "@/modules/supabase/edge-error";
import { logger } from "@/utils/logger";

export type InteractionAction = "like" | "dislike";

export type InteractionResponse =
  | { status: "liked"; match: boolean; match_id: string | null }
  | { status: "disliked" };

export type UnmatchResponse = { status: "unmatched"; match_id: string };

export type InteractionBatchItem = {
  to_user_id: string;
  action: InteractionAction;
  place_id: string;
};

export type InteractionBatchResult = {
  target_user_id: string;
  action: InteractionAction;
  status: "ok" | "error";
  is_match?: boolean;
  match_id?: string | null;
  error?: string;
};

export async function interactUser(params: {
  toUserId: string;
  action: InteractionAction;
  placeId: string;
}): Promise<InteractionResponse> {
  const { toUserId, action, placeId } = params;

  try {
    const { data, error } = await supabase.functions.invoke<InteractionResponse>(
      "interact-user",
      {
        body: { to_user_id: toUserId, action, place_id: placeId },
      }
    );

    if (error) {
      logger.error("interactUser (edge) error", { error });

      const message = await extractEdgeErrorMessage(
        error,
        "Failed to interact with user."
      );
      throw new Error(message);
    }

    if (!data) {
      throw new Error("No response from interact-user.");
    }

    // Track match analytics conversion event
    if (data.status === "liked" && data.match) {
      trackMatch({ matchId: data.match_id, placeId });
    }

    return data;
  } catch (err) {
    logger.error("interactUser (api) error", { err });
    throw err instanceof Error
      ? err
      : new Error("Unexpected error interacting with user.");
  }
}

export async function interactUsersBatch(params: {
  batch: InteractionBatchItem[];
}): Promise<InteractionBatchResult[]> {
  const { batch } = params;

  try {
    const { data, error } = await supabase.functions.invoke<{
      results: InteractionBatchResult[];
    }>("interact-user", {
      body: { batch },
    });

    if (error) {
      logger.error("interactUsersBatch (edge) error", { error });
      const message = await extractEdgeErrorMessage(
        error,
        "Failed to interact with users."
      );
      throw new Error(message);
    }

    if (!data?.results) {
      throw new Error("No response from interact-user batch.");
    }

    return data.results;
  } catch (err) {
    logger.error("interactUsersBatch (api) error", { err });
    throw err instanceof Error
      ? err
      : new Error("Unexpected error interacting with users.");
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
      logger.error("unmatchUser (edge) error", { error });
      const message = await extractEdgeErrorMessage(
        error,
        "Failed to unmatch user."
      );
      throw new Error(message);
    }

    if (!data) {
      throw new Error("No response from unmatch-user.");
    }

    return data;
  } catch (err) {
    logger.error("unmatchUser (api) error", { err });
    throw err instanceof Error ? err : new Error("Unexpected error unmatching.");
  }
}
