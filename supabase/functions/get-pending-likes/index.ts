/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

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

  if (req.method !== "POST") {
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
      return new Response(
        JSON.stringify({ error: "config_missing" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const serviceSupabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    // Verify user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userPhotosBucket = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";

    // Call RPC get_pending_likes_users(viewer_id)
    const { data: users, error } = await serviceSupabase.rpc("get_pending_likes_users", {
      viewer_id: user.id,
    });

    if (error) {
      console.error("get_pending_likes_users rpc error:", error);
      return new Response(
        JSON.stringify({ error: "rpc_error", message: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const pendingUsers = users || [];

    // Extract all unique favorite place IDs
    const allFavoritePlaceIds = Array.from(
      new Set(
        (pendingUsers || []).flatMap((user: any) => user.favorite_places || [])
      )
    ).filter(Boolean) as string[];

    // Fetch all favorite places from database in a single query
    let placeMap = new Map();
    if (allFavoritePlaceIds.length > 0) {
      const { data: places } = await serviceSupabase
        .from("places")
        .select("id, name, category")
        .in("id", allFavoritePlaceIds);
      
      if (places) {
        placeMap = new Map(places.map((p) => [p.id, p]));
      }
    }


    // Process users: resolve photos and favorite places
    const usersWithSignedPhotos = await Promise.all(
      (pendingUsers || []).map(async (user: any) => {
        const photos = user.photos || [];
        const signedPhotos = await Promise.all(
          photos.map(async (path: string) => {
             // Basic signed URL generation per photo to match get-active-users-at-place logic
            const { data: signedData } = await serviceSupabase.storage
              .from(userPhotosBucket)
              .createSignedUrl(path, 60 * 60); // 1 hour expiry
            return signedData?.signedUrl || null;
          })
        );

        // Map favorite places to objects
        const favoritePlaces = (user.favorite_places || []).map((id: string) => {
          const details = placeMap.get(id);
          return {
            id: id,
            name: details?.name || "Unknown Place",
            category: details?.category || ""
          };
        });

        return {
          user_id: user.user_id,
          name: user.name,
          age: user.age,
          bio: user.bio,
          intentions: [], // Default for compatibility
          photos: signedPhotos.filter((url) => url !== null),
          entered_at: user.created_at, // Use like creation time as entered_at
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mock expiry
          visited_places_count: 0,
          favorite_places: favoritePlaces,
          job_title: user.job_title,
          company_name: user.company_name,
          height_cm: user.height_cm,
          location: user.city_name
            ? `${user.city_name}${user.state_name ? `, ${user.state_name}` : ""}`
            : null,
          languages: user.languages || [],
          relationship_status: user.relationship_status,
          smoking_habit: user.smoking_habit,
          education_level: user.education_level,
          place_id: user.place_id,
          zodiac_sign: user.zodiac_sign,
        };
      })
    );

    return new Response(
      JSON.stringify({
        count: usersWithSignedPhotos.length,
        users: usersWithSignedPhotos,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("get-pending-likes error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: err?.message }), { status: 500, headers: corsHeaders });
  }
});