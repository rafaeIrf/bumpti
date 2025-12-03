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
