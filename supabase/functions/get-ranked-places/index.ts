import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate User
    try {
      await requireAuth(req);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lat, lng, rankBy, maxResults } = await req.json();

    // Validation
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return new Response(JSON.stringify({ error: "Invalid coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rankByValue = rankBy === "total" ? "total" : "monthly";
    const maxResultsNum = Number.isFinite(Number(maxResults)) ? Number(maxResults) : 20;

    // Get user ID from auth token for filtering
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { data: places, error } = await supabase.rpc("get_ranked_places", {
      user_lat: latNum,
      user_lng: lngNum,
      radius_meters: 50000, // 50km radius
      rank_by: rankByValue,
      max_results: maxResultsNum,
      requesting_user_id: userId,
    });

    if (error) {
      console.error("RPC Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all((places || []).map(async (p: any) => {
      // Build address parts
      const addressParts = [];
      if (p.street && p.house_number) {
        addressParts.push(`${p.street}, ${p.house_number}`);
      } else if (p.street) {
        addressParts.push(p.street);
      }

      // Sign preview avatar URLs (UserAvatar[] with user_id)
      const signedAvatars = await signUserAvatars(supabase, p.preview_avatars);

      // Destructure to remove raw review fields from top-level response
      const { review_average, review_count, review_tags, preview_avatars, ...placeData } = p;

      return {
        placeId: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        formattedAddress: addressParts.join(", "),
        neighborhood: p.neighborhood || undefined,
        city: p.city,
        state: p.state,
        country: p.country,
        totalCheckins: p.total_checkins,
        monthlyCheckins: p.monthly_checkins,
        totalMatches: p.total_matches || 0,
        monthlyMatches: p.monthly_matches || 0,
        distance: p.dist_meters,
        rankPosition: p.rank_position,
        activeUsers: p.active_users || 0,
        preview_avatars: signedAvatars.length > 0 ? signedAvatars : undefined,
        review: p.review_count > 0 ? {
          average: p.review_average,
          count: p.review_count,
          tags: p.review_tags
        } : undefined,
        regulars_count: p.regulars_count ?? 0,
      };
    }));

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
