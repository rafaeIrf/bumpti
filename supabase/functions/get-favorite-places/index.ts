/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

interface FavoritePlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  street: string | null;
  house_number: string | null;
  neighborhood: string | null;  // NEW
  city: string | null;
  state: string | null;
  country: string | null;
  review_average: number;
  review_count: number;
  review_tags: string[];
  dist_meters: number;
  active_users: number;
  preview_avatars: { user_id: string; url: string }[] | null;
  regulars_count: number;
}

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
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Missing access token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "config_missing" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: userError?.message ?? "User not found" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const requestBody =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userLat = requestBody.lat ?? 0;
    const userLng = requestBody.lng ?? 0;

    // Single RPC call - replaces 3 DB queries
    const { data: places, error } = await supabase.rpc(
      "get_user_favorite_places",
      {
        user_lat: userLat,
        user_lng: userLng,
        requesting_user_id: user.id,
      }
    );

    if (error) {
      console.error("RPC error:", error);
      return new Response(
        JSON.stringify({ error: "fetch_favorites_failed", message: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Use admin client to sign avatar URLs
    const adminSupabase = createAdminClient();

    const results = await Promise.all((places || []).map(async (p: FavoritePlace) => {
      const signedAvatars = await signUserAvatars(adminSupabase, p.preview_avatars);
      return {
        placeId: p.id,
        name: p.name,
        types: p.category ? [p.category] : [],
        latitude: p.lat,
        longitude: p.lng,
        formattedAddress: [p.street, p.house_number].filter(Boolean).join(", "),
        neighborhood: p.neighborhood || undefined,
        distance: Math.round(p.dist_meters),
        active_users: p.active_users,
        preview_avatars: signedAvatars.length > 0 ? signedAvatars : undefined,
        review:
          p.review_count > 0
            ? {
                average: p.review_average,
                count: p.review_count,
                tags: p.review_tags,
              }
            : undefined,
        regulars_count: p.regulars_count ?? 0,
      };
    }));

    return new Response(JSON.stringify({ places: results }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to fetch favorites.";
    console.error("get-favorite-places error:", err);
    return new Response(
      JSON.stringify({ error: "fetch_favorites_failed", message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
