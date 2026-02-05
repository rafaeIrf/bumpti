// Deletion detection via soft delete (status=unmatched) and sync_deletions audit table
import { fetchCascadeDeletions } from "./deletions.ts";
import {
  fetchPhotosInBatch,
  signPhotoUrl,
  signPhotoUrlsInBatch,
} from "./media.ts";
import type { SyncChanges } from "./types.ts";

export async function fetchMatchesChanges(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[],
  _localMatchIds: string[] = [] // Not used - kept for API compatibility
): Promise<SyncChanges> {
  const matches = await fetchMatchesFromDB(
    supabaseAdmin,
    userId,
    sinceDate,
    forceUpdates,
    usersWithPhotoUpdates
  );

  console.log("[fetchMatchesChanges] Total matches fetched:", matches.length);

  const userIds = matches.map((m: any) =>
    m.user_a === userId ? m.user_b : m.user_a
  );
  const photosMap = await fetchPhotosInBatch(supabaseAdmin, userIds);

  return await transformAndClassifyMatches(
    matches,
    userId,
    sinceDate,
    forceUpdates,
    usersWithPhotoUpdates,
    photosMap,
    supabaseAdmin
  );
}

export async function fetchMatchesForMediaRefresh(
  supabaseAdmin: any,
  userId: string
): Promise<any[]> {
  const matches = await fetchMatchesFromDB(
    supabaseAdmin,
    userId,
    null,
    true,
    []
  );

  if (!matches.length) return [];

  const userIds = matches.map((m: any) =>
    m.user_a === userId ? m.user_b : m.user_a
  );
  const photosMap = await fetchPhotosInBatch(supabaseAdmin, userIds);
  const photoPaths = userIds
    .map((id: string) => photosMap.get(id))
    .filter(Boolean) as string[];
  const signedByPath = await signPhotoUrlsInBatch(supabaseAdmin, photoPaths);

  const signedByUserId = new Map<string, string | null>();
  userIds.forEach((id: string) => {
    const path = photosMap.get(id);
    if (!path) return;
    signedByUserId.set(id, signedByPath.get(path) ?? null);
  });

  return transformMatchesForMediaRefresh(matches, userId, signedByUserId);
}

export async function fetchUnmatchedChatIdsForDeletion(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean
): Promise<string[]> {
  let query = supabaseAdmin
    .from("user_matches")
    .select(
      `
      unmatched_at,
      chats(
        id
      )
    `
    )
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq("status", "unmatched");

  if (sinceDate && !forceUpdates) {
    query = query.gt("unmatched_at", sinceDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Matches] Unmatched chat fetch error:", error);
    throw error;
  }

  return (data || [])
    .map((row: any) => {
      const chats = Array.isArray(row.chats) ? row.chats : [row.chats];
      return chats?.[0]?.id ?? null;
    })
    .filter(Boolean);
}

async function fetchMatchesFromDB(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
) {
  let query = supabaseAdmin
    .from("user_matches")
    .select(`
      id, user_a, user_b, status, matched_at, unmatched_at,
      place_id, place_name, user_a_opened_at, user_b_opened_at,
      profile_a:profiles!user_a(id, name),
      profile_b:profiles!user_b(id, name),
      chats(
        id,
        first_message_at
      )
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in("status", ["active", "unmatched"]);

  if (sinceDate && !forceUpdates) {
    const dateFilter = `matched_at.gt.${sinceDate},unmatched_at.gt.${sinceDate},user_a_opened_at.gt.${sinceDate},user_b_opened_at.gt.${sinceDate}`;

    if (usersWithPhotoUpdates.length > 0) {
      const userFilters = usersWithPhotoUpdates
        .map((uid) => `user_a.eq.${uid},user_b.eq.${uid}`)
        .join(",");
      query = query.or(`${dateFilter},${userFilters}`);
    } else {
      query = query.or(dateFilter);
    }
  }

  const { data, error } = await query.order("matched_at", { ascending: true });

  if (error) {
    console.error("[Matches] DB error:", error);
    throw error;
  }

  return data || [];
}

async function transformAndClassifyMatches(
  matches: any[],
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[],
  photosMap: Map<string, string>,
  supabaseAdmin: any
): Promise<SyncChanges> {
  const created: any[] = [];
  const updated: any[] = [];
  const deleted: string[] = [];

  // Query CASCADE deletions from audit table (e.g., when other user deleted account)
  const cascadeDeletedIds = await fetchCascadeDeletions(
    supabaseAdmin,
    "user_matches",
    userId,
    sinceDate
  );
  deleted.push(...cascadeDeletedIds);

  for (const match of matches) {
    // Process unmatched status (soft delete)
    if (match.status === "unmatched") {
      if (
        forceUpdates ||
        !sinceDate ||
        (match.unmatched_at &&
          new Date(match.unmatched_at).getTime() >
            new Date(sinceDate).getTime())
      ) {
        deleted.push(match.id);
      }
      continue;
    }

    const isUserA = match.user_a === userId;
    const otherUserId = isUserA ? match.user_b : match.user_a;
    const otherProfile = isUserA ? match.profile_b : match.profile_a;
    const hasPhotoUpdate = usersWithPhotoUpdates.includes(otherUserId);

    const photoPath = photosMap.get(otherUserId);
    const signedPhotoUrl = photoPath
      ? await signPhotoUrl(supabaseAdmin, photoPath)
      : null;

    const timestamps = [
      match.matched_at,
      match.unmatched_at,
      match.user_a_opened_at,
      match.user_b_opened_at,
    ]
      .filter(Boolean)
      .map((t: string) => new Date(t).getTime());

    const chatData = Array.isArray(match.chats) ? match.chats[0] : match.chats;

    const transformed = {
      id: match.id,
      chat_id: chatData?.id || null,
      first_message_at: chatData?.first_message_at
        ? new Date(chatData.first_message_at).getTime()
        : null,
      user_a: match.user_a,
      user_b: match.user_b,
      status: match.status,
      matched_at: match.matched_at ? new Date(match.matched_at).getTime() : null,
      unmatched_at: match.unmatched_at
        ? new Date(match.unmatched_at).getTime()
        : null,
      place_id: match.place_id,
      user_a_opened_at: match.user_a_opened_at
        ? new Date(match.user_a_opened_at).getTime()
        : null,
      user_b_opened_at: match.user_b_opened_at
        ? new Date(match.user_b_opened_at).getTime()
        : null,
      synced_at: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
      other_user_id: otherProfile?.id,
      other_user_name: otherProfile?.name,
      other_user_photo_url: signedPhotoUrl,
      place_name: match.place_name,
    };

    if (forceUpdates || hasPhotoUpdate) {
      updated.push(transformed);
    } else if (
      !sinceDate ||
      new Date(match.matched_at).getTime() > new Date(sinceDate).getTime()
    ) {
      created.push(transformed);
    } else {
      updated.push(transformed);
    }
  }

  return { created, updated, deleted };
}

function transformMatchesForMediaRefresh(
  matches: any[],
  userId: string,
  signedPhotoMap: Map<string, string | null>
): any[] {
  return matches.map((match) => {
    const isUserA = match.user_a === userId;
    const otherUserId = isUserA ? match.user_b : match.user_a;
    const otherProfile = isUserA ? match.profile_b : match.profile_a;

    const timestamps = [
      match.matched_at,
      match.unmatched_at,
      match.user_a_opened_at,
      match.user_b_opened_at,
    ]
      .filter(Boolean)
      .map((t: string) => new Date(t).getTime());

    const chatData = Array.isArray(match.chats) ? match.chats[0] : match.chats;

    return {
      id: match.id,
      chat_id: chatData?.id || null,
      first_message_at: chatData?.first_message_at
        ? new Date(chatData.first_message_at).getTime()
        : null,
      user_a: match.user_a,
      user_b: match.user_b,
      status: match.status,
      matched_at: match.matched_at ? new Date(match.matched_at).getTime() : null,
      unmatched_at: match.unmatched_at
        ? new Date(match.unmatched_at).getTime()
        : null,
      place_id: match.place_id,
      user_a_opened_at: match.user_a_opened_at
        ? new Date(match.user_a_opened_at).getTime()
        : null,
      user_b_opened_at: match.user_b_opened_at
        ? new Date(match.user_b_opened_at).getTime()
        : null,
      synced_at: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
      other_user_id: otherProfile?.id,
      other_user_name: otherProfile?.name,
      other_user_photo_url: signedPhotoMap.get(otherUserId) ?? null,
      place_name: match.place_name,
    };
  });
}
