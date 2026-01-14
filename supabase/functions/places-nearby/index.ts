import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { triggerCityHydrationIfNeeded } from "../_shared/triggerCityHydration.ts";

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

    const { lat, lng, category, page, pageSize, sortBy, minRating } = await req.json();

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
        const { user } = await requireAuth(req);
        requestingUserId = user.id;
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const parsedPage = Number(page);
    const pageNumber =
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const parsedPageSize = Number(pageSize);
    const pageSizeNumber =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? parsedPageSize
        : 20;
    const minRatingNumber =
      minRating === null || minRating === undefined
        ? null
        : Number.isFinite(Number(minRating))
          ? Number(minRating)
          : null;
    const sortByValue = typeof sortBy === "string" ? sortBy : "relevance";

    const pageOffset = (pageNumber - 1) * pageSizeNumber;

    const { data: places, error } = await supabase.rpc("search_places_nearby", {
      user_lat: latNum,
      user_lng: lngNum,
      radius_meters: 50 * 1000,
      filter_categories: categoriesArray,
      max_results: 60,
      requesting_user_id: requestingUserId,
      sort_by: sortByValue,
      min_rating: minRatingNumber,
      page_offset: pageOffset,
      page_size: pageSizeNumber,
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

    // 🔥 LAZY HYDRATION TRIGGER: If no results, trigger city hydration
    if (results.length === 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const githubToken = Deno.env.get("GITHUB_HYDRATION_TOKEN") as string;
      
      // Trigger city hydration in background (don't wait for result)
      triggerCityHydrationIfNeeded(
        latNum,
        lngNum,
        supabaseUrl,
        serviceRoleKey,
        githubToken
      ).catch((err) => {
        console.error("City hydration trigger failed:", err);
      });
    }

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
