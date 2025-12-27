import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

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

    const mappedResults = (localPlaces || []).map((p: any) => ({
        placeId: p.id,
        name: p.name,
        formattedAddress: [
            p.street, 
            p.house_number, 
            p.city, 
            p.state, 
            p.country
        ].filter(Boolean).join(", "),
        distance: p.dist_meters ? p.dist_meters / 1000 : 0, // meters to km
        latitude: p.lat,
        longitude: p.lng,
        types: [p.category],
        active_users: p.active_users || 0
    }));

    return new Response(JSON.stringify({ places: mappedResults }), {
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
