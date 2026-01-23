import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

interface PlacesByCategory {
  category: string;
  places: {
    placeId: string;
    name: string;
    formattedAddress: string;
    types: string[];
    distance: number;
  }[];
}

const LIMIT_PLACES_PER_CATEGORY = 15;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Check if it's a POST request
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate User
    let requestingUserId: string;
    try {
      const { user } = await requireAuth(req);
      requestingUserId = user.id;
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      lat,
      lng,
      categories,
    } = await req.json();

    if (!lat || !lng || !categories || !Array.isArray(categories)) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validation
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute all category queries in PARALLEL for better performance
    const categoryPromises = categories.map(async (category: string) => {
      const { data: places, error } = await supabase.rpc("search_places_nearby", {
        user_lat: latNum,
        user_lng: lngNum,
        radius_meters: 50 * 1000, // 50km radius
        filter_categories: [category],
        max_results: LIMIT_PLACES_PER_CATEGORY,
        requesting_user_id: requestingUserId
      });

      if (error) {
        return null; // Skip this category on error
      }

      const uniquePlaces = (places || [])
        .map((place: any) => ({
          placeId: place.id,
          name: place.name,
          formattedAddress: place.street && place.city 
            ? `${place.street}, ${place.city}` 
            : place.street || place.city || "Endereço não disponível",
          types: place.category ? [place.category] : [],
          distance: Number((place.dist_meters / 1000).toFixed(2)), // Convert meters to km
        }));

      return {
        category,
        places: uniquePlaces,
      };
    });

    const resultsWithNulls = await Promise.all(categoryPromises);
    const results: PlacesByCategory[] = resultsWithNulls.filter((r): r is PlacesByCategory => r !== null);

    return new Response(
      JSON.stringify({ data: results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("get-suggested-places error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
