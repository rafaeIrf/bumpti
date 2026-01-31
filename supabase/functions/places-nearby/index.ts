import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getActiveCategories } from "../_shared/get-active-categories.ts";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";
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

    // Fetch active categories from app_config for feature flag enforcement
    const activeCategories = await getActiveCategories(supabase);

    // If categories requested, use them; otherwise use active categories for "all" queries
    const filterCategories = categoriesArray && categoriesArray.length > 0 
      ? categoriesArray 
      : activeCategories;

    const { data: places, error } = await supabase.rpc("search_places_nearby", {
      user_lat: latNum,
      user_lng: lngNum,
      radius_meters: 50 * 1000,
      filter_categories: filterCategories,
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

    // Sign avatar URLs with 24h expiration
    const results = await Promise.all((places || []).map(async (p: any) => {
        // Build address parts in proper order
        const addressParts = [];
        
        // Street with house number (e.g., "Rua Augusta, 123")
        if (p.street && p.house_number) {
            addressParts.push(`${p.street}, ${p.house_number}`);
        } else if (p.street) {
            addressParts.push(p.street);
        }

        // Sign preview avatar URLs (now returns UserAvatar[] with user_id preserved)
        const signedAvatars = await signUserAvatars(supabase, p.preview_avatars);

        // Destructure to remove raw review fields from top-level response
        const { review_average, review_count, review_tags, preview_avatars, ...placeData } = p;
        
        return {
            ...placeData,
            formatted_address: addressParts.join(", "),
            preview_avatars: signedAvatars,
            review: p.review_count > 0 ? {
                average: p.review_average,
                count: p.review_count,
                tags: p.review_tags
            } : undefined
        };
    }));

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
