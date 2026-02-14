/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { signPhotoUrls } from "../_shared/signPhotoUrls.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceSupabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const queryPlaceId = url.searchParams.get("place_id");
    const bodyParams =
      req.method === "POST"
        ? (await req.json().catch(() => null))
        : null;
    const placeId = queryPlaceId || bodyParams?.place_id;

    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const client = serviceSupabase;

    // Run RPC and likers query in PARALLEL
    const [rpcResult, likersResult] = await Promise.all([
      client.rpc("get_available_users_at_place", {
        p_place_id: placeId,
        viewer_id: user.id,
      }),
      client
        .from("user_interactions")
        .select("from_user_id")
        .eq("to_user_id", user.id)
        .eq("action", "like")
        .gt("action_expires_at", new Date().toISOString()),
    ]);

    const { data: rows, error: fetchError } = rpcResult;
    if (fetchError) throw fetchError;

    const { data: likerRows } = likersResult;

    const likerIds = (likerRows ?? [])
      .map((row) => row.from_user_id)
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
      (matchRowsA ?? []).forEach((row) => {
        if (row.user_b) matchedIds.add(row.user_b);
      });
      (matchRowsB ?? []).forEach((row) => {
        if (row.user_a) matchedIds.add(row.user_a);
      });

      filteredLikerIds = likerIds.filter((id) => !matchedIds.has(id));
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({
          place_id: placeId,
          count: 0,
          users: [],
          liker_ids: filteredLikerIds,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const filteredRows = rows;

    // Extract all unique favorite place IDs
    const allFavoritePlaceIds = Array.from(
      new Set(
        filteredRows.flatMap((row: any) => row.favorite_places || [])
      )
    ).filter(Boolean) as string[];

    // Collect ALL photo paths from ALL users for batch signing
    const allPhotoPaths: string[] = [];
    const photoIndexMap: { userId: string; paths: string[] }[] = [];
    
    for (const row of filteredRows) {
      const photos = (Array.isArray(row.photos) ? row.photos : []).filter(Boolean) as string[];
      photoIndexMap.push({ userId: row.user_id, paths: photos });
      allPhotoPaths.push(...photos);
    }

    // Run places query and photo signing in PARALLEL
    const [placesResult, allSignedUrls] = await Promise.all([
      allFavoritePlaceIds.length > 0
        ? client.from("places").select("id, name, category").in("id", allFavoritePlaceIds)
        : Promise.resolve({ data: [] }),
      signPhotoUrls(serviceSupabase, allPhotoPaths),
    ]);

    // Build place map
    const placeMap = new Map((placesResult.data || []).map((p: any) => [p.id, p]));

    // Build signed URL map for each user
    let urlIndex = 0;
    const userSignedUrlsMap = new Map<string, string[]>();
    for (const entry of photoIndexMap) {
      const count = entry.paths.length;
      const userUrls = allSignedUrls.slice(urlIndex, urlIndex + count);
      userSignedUrlsMap.set(entry.userId, userUrls);
      urlIndex += count;
    }

    // Build users array (no async needed now - all data is pre-fetched)
    const users = filteredRows.map((row: any) => {
      const favoritePlaces = (row.favorite_places || []).map((id: string) => {
        const details = placeMap.get(id);
        return {
          id: id,
          name: details?.name || "Unknown Place",
          category: details?.category || ""
        };
      });

      return {
        user_id: row.user_id,
        name: row.name,
        age: row.age,
        bio: row.bio,
        intentions: Array.isArray(row.intentions)
          ? row.intentions.map((i: any) => (i == null ? null : String(i)))
          : [],
        interests: Array.isArray(row.interests)
          ? row.interests.map((i: any) => (i == null ? null : String(i)))
          : [],
        photos: userSignedUrlsMap.get(row.user_id) || [],
        visited_places_count: 0, 
        favorite_places: favoritePlaces,
        job_title: row.job_title,
        company_name: row.company_name,
        height_cm: row.height_cm,
        languages: row.languages || [],
        relationship_status: row.relationship_status,
        smoking_habit: row.smoking_habit,
        education_level: row.education_level,
        place_id: placeId,
        entered_at: row.entered_at,
        expires_at: row.expires_at,
        zodiac_sign: row.zodiac_sign,
        entry_type: row.entry_type || 'physical',
        // University fields
        university_id: row.university_id,
        university_name: row.university_name,
        university_name_custom: row.university_name_custom,
        graduation_year: row.graduation_year,
        show_university_on_home: row.show_university_on_home,
      };
    });

    return new Response(
      JSON.stringify({
        place_id: placeId,
        count: users.length,
        users,
        liker_ids: filteredLikerIds,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
