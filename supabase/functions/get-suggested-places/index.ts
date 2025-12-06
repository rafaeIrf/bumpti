import { createClient } from "jsr:@supabase/supabase-js@2";
import { CATEGORY_TO_IDS } from "../_shared/foursquare/categories.ts";
import { searchNearbyPlaces } from "../_shared/foursquare/searchNearby.ts";
import { FoursquareSortOrder } from "../_shared/foursquare/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      lat,
      lng,
      categories,
      limitPerCategory = 15,
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

    // Fetch places for each category
    const results: PlacesByCategory[] = [];

    for (const category of categories) {
      const categoryIds = CATEGORY_TO_IDS[category];
      if (!categoryIds) {
        console.warn(`Unknown category: ${category}`);
        continue;
      }

      const fsqPlaces = await searchNearbyPlaces({
        userLat: lat,
        userLng: lng,
        categories: categoryIds,
        limit: limitPerCategory,
        radius: 20000, // 20km radius
        sort: FoursquareSortOrder.DISTANCE,
        openNow: false,
      });

      const places = fsqPlaces.map((place) => ({
        placeId: place.fsq_id,
        name: place.name,
        formattedAddress: place.formatted_address || "Endereço não disponível",
        types: place.categories.map((cat) => cat.name),
        distance: Number(place.distance.toFixed(2)),
      }));

      results.push({
        category,
        places,
      });
    }

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
