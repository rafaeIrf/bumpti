import { requireAuth } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { internalError, jsonError, jsonOk, methodNotAllowed } from "../_shared/response.ts";
import { signPhotoUrls } from "../_shared/signPhotoUrls.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRow {
  user_id: string;
  name: string;
  age: number | null;
  bio: string | null;
  intentions: string[];
  interests: string[];
  photos: string[];
  favorite_places: string[];
  job_title: string | null;
  company_name: string | null;
  height_cm: number | null;
  zodiac_sign: string | null;
  education_level: string | null;
  relationship_status: string | null;
  smoking_habit: string | null;
  languages: string[];
  city_name: string | null;
  city_state: string | null;
  entered_at: string | null;
  expires_at?: string | null;
  entry_type: string;
  planned_for?: string | null;
  planned_period?: string | null;
  university_id: string | null;
  university_name: string | null;
  university_name_custom: string | null;
  graduation_year: number | null;
  show_university_on_home: boolean;
  verification_status?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Batch-sign photo URLs and build a userId → signedUrls map.
 * Both active users and regulars share this exact logic.
 */
async function batchSignPhotos(
  supabase: any,
  rows: UserRow[],
): Promise<Map<string, string[]>> {
  const allPaths: string[] = [];
  const indexMap: { userId: string; count: number }[] = [];

  for (const row of rows) {
    const paths = (Array.isArray(row.photos) ? row.photos : []).filter(Boolean);
    indexMap.push({ userId: row.user_id, count: paths.length });
    allPaths.push(...paths);
  }

  const allSigned = allPaths.length > 0
    ? await signPhotoUrls(supabase, allPaths)
    : [];

  let offset = 0;
  const map = new Map<string, string[]>();
  for (const { userId, count } of indexMap) {
    map.set(userId, allSigned.slice(offset, offset + count));
    offset += count;
  }
  return map;
}

/**
 * Resolve favorite place IDs → { id, name, category } using a batch query.
 */
async function resolveFavoritePlaces(
  client: any,
  rows: UserRow[],
): Promise<Map<string, any>> {
  const allIds = Array.from(
    new Set(rows.flatMap((r) => r.favorite_places || []))
  ).filter(Boolean) as string[];

  if (allIds.length === 0) return new Map();

  const { data } = await client
    .from("places")
    .select("id, name, category")
    .in("id", allIds);

  return new Map((data || []).map((p: any) => [p.id, p]));
}

/**
 * Build the response object for a user row, using pre-fetched signed URLs
 * and place details. Works identically for active users and regulars.
 */
function buildUserResponse(
  row: UserRow,
  placeId: string,
  signedUrlsMap: Map<string, string[]>,
  placeMap: Map<string, any>,
) {
  const favoritePlaces = (row.favorite_places || []).map((id: string) => {
    const details = placeMap.get(id);
    return {
      id,
      name: details?.name || "Unknown Place",
      category: details?.category || "",
    };
  });

  return {
    user_id: row.user_id,
    name: row.name,
    age: row.age,
    bio: row.bio,
    intentions: (row.intentions || []).map((i: any) =>
      i == null ? null : String(i)
    ),
    interests: (row.interests || []).map((i: any) =>
      i == null ? null : String(i)
    ),
    photos: signedUrlsMap.get(row.user_id) || [],
    visited_places_count: 0,
    favorite_places: favoritePlaces,
    job_title: row.job_title,
    company_name: row.company_name,
    height_cm: row.height_cm,
    languages: row.languages || [],
    location:
      row.city_name && row.city_state
        ? `${row.city_name}, ${row.city_state}`
        : row.city_name || null,
    relationship_status: row.relationship_status,
    smoking_habit: row.smoking_habit,
    education_level: row.education_level,
    place_id: placeId,
    entered_at: row.entered_at,
    expires_at: row.expires_at ?? null,
    zodiac_sign: row.zodiac_sign,
    entry_type: row.entry_type || "physical",
    planned_for: row.planned_for ?? null,
    planned_period: row.planned_period ?? null,
    university_id: row.university_id,
    university_name: row.university_name,
    university_name_custom: row.university_name_custom,
    graduation_year: row.graduation_year,
    show_university_on_home: row.show_university_on_home,
    verification_status: row.verification_status ?? null,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    // Auth
    const auth = await requireAuth(req);
    if (!auth.success) return auth.response;
    const { user } = auth;

    // Parse place_id from query string or body
    const url = new URL(req.url);
    const queryPlaceId = url.searchParams.get("place_id");
    const bodyParams =
      req.method === "POST" ? await req.json().catch(() => null) : null;
    const placeId = queryPlaceId || bodyParams?.place_id;

    if (!placeId || typeof placeId !== "string") {
      return jsonError("invalid_place_id", "place_id is required", 400);
    }

    const client = createAdminClient();

    // ── Parallel: active users, regulars, likers ──
    const [rpcResult, regularsResult, likersResult] = await Promise.all([
      client.rpc("get_available_users_at_place", {
        p_place_id: placeId,
        viewer_id: user.id,
      }),
      client.rpc("get_eligible_regulars_at_place", {
        target_place_id: placeId,
        requesting_user_id: user.id,
      }),
      client
        .from("user_interactions")
        .select("from_user_id")
        .eq("to_user_id", user.id)
        .eq("action", "like")
        .gt("action_expires_at", new Date().toISOString()),
    ]);

    const { data: activeRows, error: activeError } = rpcResult;
    if (activeError) {
      console.error("[get-active-users] RPC get_available_users_at_place failed:", JSON.stringify(activeError));
      throw activeError;
    }

    const { data: regularRows, error: regularsError } = regularsResult;
    if (regularsError) {
      console.error("[get-active-users] RPC get_eligible_regulars_at_place failed:", JSON.stringify(regularsError));
      // Non-fatal: continue without regulars
    }

    console.log(
      `[get-active-users] Active: ${activeRows?.length ?? 0}, Regulars: ${regularRows?.length ?? 0} for place ${placeId}`
    );

    // ── Liker filtering (exclude already matched) ──
    const { data: likerRows } = likersResult;
    const likerIds = (likerRows ?? [])
      .map((r: any) => r.from_user_id)
      .filter(Boolean) as string[];

    let filteredLikerIds = likerIds;
    if (likerIds.length > 0) {
      const [{ data: matchRowsA }, { data: matchRowsB }] = await Promise.all([
        client
          .from("user_matches")
          .select("user_a,user_b,status")
          .eq("user_a", user.id)
          .in("user_b", likerIds)
          .neq("status", "unmatched"),
        client
          .from("user_matches")
          .select("user_a,user_b,status")
          .eq("user_b", user.id)
          .in("user_a", likerIds)
          .neq("status", "unmatched"),
      ]);

      const matchedIds = new Set<string>();
      (matchRowsA ?? []).forEach((r: any) => r.user_b && matchedIds.add(r.user_b));
      (matchRowsB ?? []).forEach((r: any) => r.user_a && matchedIds.add(r.user_a));

      filteredLikerIds = likerIds.filter((id) => !matchedIds.has(id));
    }

    // ── Batch operations: sign photos + resolve favorites for BOTH sets ──
    const allRows = [...(activeRows || []), ...(regularRows || [])] as UserRow[];

    const [signedUrlsMap, placeMap] = await Promise.all([
      batchSignPhotos(client, allRows),
      resolveFavoritePlaces(client, allRows),
    ]);

    console.log(
      `[get-active-users] Signed photos for ${signedUrlsMap.size} users, resolved ${placeMap.size} fav places`
    );

    // ── Build response ──
    const users = (activeRows || []).map((row: any) =>
      buildUserResponse(row, placeId, signedUrlsMap, placeMap)
    );
    const regulars = (regularRows || []).map((row: any) =>
      buildUserResponse(row, placeId, signedUrlsMap, placeMap)
    );

    return jsonOk({
      place_id: placeId,
      count: users.length,
      users,
      regulars,
      regulars_count: regulars.length,
      liker_ids: filteredLikerIds,
    });
  } catch (err) {
    return internalError(err);
  }
});
