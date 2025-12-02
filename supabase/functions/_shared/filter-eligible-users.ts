import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

/**
 * Filters out users that the current user should not see based on interactions and matches.
 * 
 * Excludes:
 * - Users the current user disliked
 * - Users the current user liked (and like hasn't expired)
 * - Users who disliked the current user
 * - Users with active matches with the current user
 * 
 * Note: Users with unmatched status are NOT excluded - they can see each other and match again
 * 
 * @param supabase - Supabase client (should use service role for reading all data)
 * @param userId - Current user ID
 * @param candidateIds - Array of candidate user IDs to filter
 * @returns Set of user IDs that should be excluded
 */
export async function getExcludedUserIds(
  supabase: SupabaseClient,
  userId: string,
  candidateIds: string[]
): Promise<Set<string>> {
  const excludeIds = new Set<string>();
  const now = new Date();

  try {
    const [
      interactionsFromMe,
      interactionsToMe,
      matchesFromMe,
      matchesToMe,
    ] = await Promise.all([
      supabase
        .from("user_interactions")
        .select("to_user_id, action, action_expires_at")
        .eq("from_user_id", userId)
        .in("to_user_id", candidateIds),
      supabase
        .from("user_interactions")
        .select("from_user_id, action, action_expires_at")
        .eq("to_user_id", userId)
        .in("from_user_id", candidateIds),
      supabase
        .from("user_matches")
        .select("user_a, user_b, status")
        .eq("user_a", userId)
        .in("user_b", candidateIds)
        .eq("status", "active"),
      supabase
        .from("user_matches")
        .select("user_a, user_b, status")
        .eq("user_b", userId)
        .in("user_a", candidateIds)
        .eq("status", "active"),
    ]);

    if (interactionsFromMe.error) throw interactionsFromMe.error;
    if (interactionsToMe.error) throw interactionsToMe.error;
    if (matchesFromMe.error) throw matchesFromMe.error;
    if (matchesToMe.error) throw matchesToMe.error;

    // Exclude users I disliked
    (interactionsFromMe.data ?? []).forEach((row) => {
      if (row.action === "dislike") {
        excludeIds.add(row.to_user_id);
      }
      // Exclude users I liked and like hasn't expired
      if (
        row.action === "like" &&
        row.action_expires_at &&
        new Date(row.action_expires_at) > now
      ) {
        excludeIds.add(row.to_user_id);
      }
    });

    // Exclude users who disliked me
    (interactionsToMe.data ?? []).forEach((row) => {
      if (row.action === "dislike") {
        excludeIds.add(row.from_user_id);
      }
    });

    // Exclude users with active matches only (unmatched users can see each other again)
    [...(matchesFromMe.data ?? []), ...(matchesToMe.data ?? [])].forEach(
      (row) => {
        const candidateId = row.user_a === userId ? row.user_b : row.user_a;
        excludeIds.add(candidateId);
      }
    );
  } catch (error) {
    console.error("Error filtering eligible users:", error);
    // Return empty set on error to avoid breaking the flow
  }

  return excludeIds;
}
