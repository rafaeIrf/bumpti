
/**
 * Fetches CASCADE deletions from sync_deletions audit table
 * Used to detect hard deletes (e.g., when other user deleted account)
 */
export async function fetchCascadeDeletions(
  supabaseAdmin: any,
  tableName: "user_matches" | "chats",
  userId: string,
  sinceDate: string | null
): Promise<string[]> {
  if (!sinceDate) return [];

  const { data, error } = await supabaseAdmin
    .from("sync_deletions")
    .select("record_id")
    .eq("table_name", tableName)
    .eq("affected_user_id", userId)
    .gt("deleted_at", sinceDate);

  if (error) {
    console.error(`[${tableName}] Error fetching cascade deletions:`, error);
    return [];
  }

  const deletedIds = (data || []).map((d: any) => d.record_id);
  
  if (deletedIds.length > 0) {
    console.log(`[${tableName}] CASCADE deletions found:`, deletedIds.length);
  }

  return deletedIds;
}
