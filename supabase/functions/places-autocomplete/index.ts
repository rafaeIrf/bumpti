import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { triggerCityHydrationIfNeeded } from "../_shared/triggerCityHydration.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const { q, lat, lng, limit } = params;

    // Authentication Check
    let user;
    try {
        user = await requireAuth(req);
    } catch (e) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Validation
    if (!q || q.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Query 'q' must be at least 2 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse logic
    const limitParams = limit ? parseInt(limit) : 10;
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    const radiusNum = 50; // Default radius 50km

    // 1. Local Search (RPC)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);


    const { data: localPlaces, error: rpcError } = await supabase.rpc("search_places_autocomplete", {
        query_text: q,
        user_lat: latNum,
        user_lng: lngNum,
        radius_meters: radiusNum * 1000, // km to meters
        max_results: limitParams,
        requesting_user_id: user.id
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const results = (localPlaces || []).map((p: any) => {
        const addressParts = [];
        
        if (p.street && p.house_number) {
            addressParts.push(`${p.street}, ${p.house_number}`);
        } else if (p.street) {
            addressParts.push(p.street);
        }

        // Destructure to remove raw review fields from top-level response
        const { review_average, review_count, review_tags, ...placeData } = p;
        
        return {
            ...placeData,
            formatted_address: addressParts.join(", "),
            review: p.review_count > 0 ? {
                average: p.review_average,
                count: p.review_count,
                tags: p.review_tags
            } : undefined
        };
    });

    // 🔥 SWR AUTO-REFRESH: Always check city age for background updates
    // Even if results exist, trigger hydration if city is stale (>60 days)
    if (latNum && lngNum) {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const githubToken = Deno.env.get("GH_HYDRATION_TOKEN") as string;
      
      // Trigger in background (don't wait for result, don't block response)
      triggerCityHydrationIfNeeded(
        supabaseUrl,
        serviceRoleKey,
        latNum.toString(),
        lngNum.toString(),
        githubToken
      ).catch((err) => console.error("Hydration trigger failed:", err));
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return new Response(JSON.stringify([]), {
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
