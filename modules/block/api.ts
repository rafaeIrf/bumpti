import { supabase } from "@/modules/supabase/client";
import { extractEdgeErrorMessage } from "@/modules/supabase/edge-error";

type BlockUserParams = {
  blockedUserId: string;
};

type BlockUserResponse = {
  status: "ok";
};

export async function blockUser({
  blockedUserId,
}: BlockUserParams): Promise<BlockUserResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<BlockUserResponse>(
      "block-user",
      {
        body: { blocked_user_id: blockedUserId },
      }
    );

    if (error) {
      console.error("blockUser (edge) error:", error);
      const message = await extractEdgeErrorMessage(
        error,
        "Failed to block user."
      );
      throw new Error(message);
    }

    if (!data) {
      throw new Error("No response from block-user.");
    }

    return data;
  } catch (err) {
    console.error("blockUser (api) error:", err);
    throw err instanceof Error
      ? err
      : new Error("Unexpected error blocking user.");
  }
}

export type BlockedUser = {
  blocked_user_id: string;
  created_at: string;
  user_details: {
    id: string;
    firstName: string;
    photoUrl?: string | null;
  };
};

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  try {
    const { data, error } = await supabase.functions.invoke<BlockedUser[]>(
      "get-blocked-users"
    );

    if (error) {
      console.error("getBlockedUsers (edge) error:", error);
      const message = await extractEdgeErrorMessage(
        error,
        "Failed to fetch blocked users."
      );
      throw new Error(message);
    }

    return data || [];
  } catch (err) {
    console.error("getBlockedUsers (api) error:", err);
    throw err instanceof Error
      ? err
      : new Error("Unexpected error fetching blocked users.");
  }
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("unblock-user", {
      body: { blocked_user_id: blockedUserId },
    });

    if (error) {
      console.error("unblockUser (edge) error:", error);
      const message = await extractEdgeErrorMessage(
        error,
        "Failed to unblock user."
      );
      throw new Error(message);
    }
  } catch (err) {
    console.error("unblockUser (api) error:", err);
    throw err instanceof Error
      ? err
      : new Error("Unexpected error unblocking user.");
  }
}
