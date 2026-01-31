import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getActiveCategories } from "../_shared/get-active-categories.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { triggerCityHydrationIfNeeded } from "../_shared/triggerCityHydration.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const { q, lat, lng, limit, category } = params;

    // Authentication Check
    const authResult = await requireAuth(req);
    if (!authResult.success) {
        return authResult.response;
    }
    const { user } = authResult;

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

    // Fetch active categories from app_config
    const activeCategories = await getActiveCategories(supabase);
    
    // Use user filter if provided, otherwise use active categories from feature flags
    const filterCategories = category 
      ? category.split(',').map((c: string) => c.trim())
      : activeCategories;



    // 🔥 SWR AUTO-REFRESH: Always check city age for background updates
    // Even if results exist, trigger hydration if city is stale (>60 days)
    if (latNum && lngNum) {
      // Trigger in background (don't wait for result, don't block response)
      triggerCityHydrationIfNeeded(
        latNum.toString(),
        lngNum.toString()
      ).catch((err) => console.error("Hydration trigger failed:", err));
    }


    const { data: localPlaces, error: rpcError } = await supabase.rpc("search_places_autocomplete", {
        query_text: q,
        user_lat: latNum,
        user_lng: lngNum,
        radius_meters: radiusNum * 1000, // km to meters
        max_results: limitParams,
        requesting_user_id: user.id,
        filter_categories: filterCategories
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Use admin client to sign avatar URLs
    const adminSupabase = createAdminClient();

    // NOTE: Skipping avatar fetch in autocomplete for performance
    // Avatars will be fetched when user selects a place
    const avatarsMap = new Map<string, { count: number; avatars: string[] }>();

    const results = (localPlaces || []).map((p: any) => {
        const addressParts = [];
        
        if (p.street && p.house_number) {
            addressParts.push(`${p.street}, ${p.house_number}`);
        } else if (p.street) {
            addressParts.push(p.street);
        }

        // Destructure to remove raw fields from top-level response
        const { review_average, review_count, review_tags, preview_avatars, ...placeData } = p;
        
        return {
            ...placeData,
            formatted_address: addressParts.join(", "),
            // active_users already comes from RPC
            preview_avatars: undefined, // No avatars in autocomplete for performance
            review: p.review_count > 0 ? {
                average: p.review_average,
                count: p.review_count,
                tags: p.review_tags
            } : undefined
        };
    });

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
