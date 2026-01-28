/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface TrendingPlace {
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
  total_count: number;
}

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
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const requestBody = await req.json().catch(() => ({}));
    const userLat = requestBody.lat ?? 0;
    const userLng = requestBody.lng ?? 0;
    const radiusMeters = requestBody.radius_meters ?? 50000;

    // Parse pagination params
    const parsedPage = Number(requestBody.page);
    const pageNumber = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const parsedPageSize = Number(requestBody.pageSize);
    const pageSizeNumber = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 20;
    const pageOffset = (pageNumber - 1) * pageSizeNumber;

    // Single RPC call with pagination
    const { data: places, error } = await supabase.rpc("get_trending_places", {
      user_lat: userLat,
      user_lng: userLng,
      radius_meters: radiusMeters,
      requesting_user_id: user.id,
      page_offset: pageOffset,
      page_size: pageSizeNumber,
    });

    if (error) {
      console.error("RPC error:", error);
      return new Response(
        JSON.stringify({ error: "rpc_error", message: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Use admin client to sign avatar URLs
    const adminSupabase = createAdminClient();

    // Extract totalCount from first result (all rows have the same total_count)
    const totalCount = places?.[0]?.total_count ?? 0;

    const results = await Promise.all((places || []).map(async (p: TrendingPlace) => {
      const signedAvatars = await signUserAvatars(adminSupabase, p.preview_avatars);
      return {
        place_id: p.id,
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
      };
    }));

    return new Response(JSON.stringify({ places: results, totalCount }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("Internal error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
