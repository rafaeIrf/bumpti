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
    
    // Check if it's a POST request (as client sends body)
    if (req.method !== "POST") {
         return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lat, lng, category } = await req.json();

    // Validation
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure category is treated as an array or null
    // If it comes as "bar,nightclub", split it.
    let categoriesArray: string[] | null = null;
    if (Array.isArray(category)) {
      categoriesArray = category;
    } else if (typeof category === "string") {
      categoriesArray = category.split(",").map((c: string) => c.trim()).filter(Boolean);
    }

    // Get User ID from Token (if available) to filter active counts
    // Authenticate User
    let requestingUserId: string;
    try {
        const user = await requireAuth(req);
        requestingUserId = user.id;
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: places, error } = await supabase.rpc("search_places_nearby", {
      user_lat: latNum,
      user_lng: lngNum,
      radius_meters: 50 * 1000,
      filter_categories: categoriesArray,
      max_results: 50,
      requesting_user_id: requestingUserId
    });

    if (error) {
       console.error("RPC Error:", error);
       // Fallback or error?
       // If RPC is missing, we can't search effectively.
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = (places || []).map((p: any) => {
        // Build address parts in proper order
        const addressParts = [];
        
        // Street with house number (e.g., "Rua Augusta, 123")
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

    // Note: The auto-seed logic was removed since places are now populated manually.
    // If no places are found in a city, they need to be imported manually.

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error nearby:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
