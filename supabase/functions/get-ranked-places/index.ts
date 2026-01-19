import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
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

    const { data: places, error } = await supabase.rpc("get_ranked_places", {
      user_lat: latNum,
      user_lng: lngNum,
      radius_meters: 50000, // 50km radius
      rank_by: rankByValue,
      max_results: maxResultsNum,
    });

    if (error) {
      console.error("RPC Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = (places || []).map((p: any) => {
      // Build address parts
      const addressParts = [];
      if (p.street && p.house_number) {
        addressParts.push(`${p.street}, ${p.house_number}`);
      } else if (p.street) {
        addressParts.push(p.street);
      }

      // Destructure to remove raw review fields from top-level response
      const { review_average, review_count, review_tags, ...placeData } = p;

      return {
        placeId: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        formattedAddress: addressParts.join(", "),
        city: p.city,
        state: p.state,
        country: p.country,
        totalCheckins: p.total_checkins,
        monthlyCheckins: p.monthly_checkins,
        distance: p.dist_meters,
        rankPosition: p.rank_position,
        review: p.review_count > 0 ? {
          average: p.review_average,
          count: p.review_count,
          tags: p.review_tags
        } : undefined,
      };
    });

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
