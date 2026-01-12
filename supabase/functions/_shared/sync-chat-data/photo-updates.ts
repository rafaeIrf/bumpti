export async function detectPhotoUpdates(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string
): Promise<string[]> {
  try {
    const { data: matches } = await supabaseAdmin
      .from("user_matches")
      .select("user_a, user_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq("status", "active");

    if (!matches?.length) return [];

    const otherUserIds = [...new Set(
      matches.map((m: any) => (m.user_a === userId ? m.user_b : m.user_a))
    )];

    const { data: updatedPhotos } = await supabaseAdmin
      .from("profile_photos")
      .select("user_id")
      .in("user_id", otherUserIds)
      .gt("created_at", sinceDate);

    if (!updatedPhotos?.length) return [];

    const usersWithUpdates = [...new Set(updatedPhotos.map((p: any) => p.user_id))];
    console.log("[PhotoUpdates] Found:", usersWithUpdates.length, "users");

    return usersWithUpdates;
  } catch (error) {
    console.error("[PhotoUpdates] Error:", error);
    return [];
  }
}
