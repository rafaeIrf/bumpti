/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface SocialReviewPayload {
  placeId: string;
  rating: number;
  selectedVibes: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // 1. Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 2. Validate Input
    const payload: SocialReviewPayload = await req.json().catch(() => ({}));
    const { placeId, rating, selectedVibes } = payload;

    if (!placeId) {
      return new Response(JSON.stringify({ error: "missing_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "invalid_rating" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!Array.isArray(selectedVibes) || selectedVibes.length === 0) {
      return new Response(JSON.stringify({ error: "missing_selected_vibes" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (selectedVibes.length > 3) {
      return new Response(JSON.stringify({ error: "too_many_tags" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 3. Verify Place and Tags
    // Check if place exists
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("id")
      .eq("id", placeId)
      .maybeSingle();

    if (placeError || !place) {
      return new Response(JSON.stringify({ error: "place_not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Verify all tags exist and are active
    const { data: tags, error: tagsError } = await supabase
      .from("place_review_tags")
      .select("id, key")
      .in("key", selectedVibes)
      .eq("active", true);

    if (tagsError) {
      throw new Error(`Error fetching tags: ${tagsError.message}`);
    }

    if (!tags || tags.length !== selectedVibes.length) {
      const foundKeys = tags?.map((t) => t.key) || [];
      const missingKeys = selectedVibes.filter((k) => !foundKeys.includes(k));
      return new Response(
        JSON.stringify({
          error: "invalid_tags",
          message: `Some tags are invalid or inactive: ${missingKeys.join(", ")}`,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const tagIds = tags.map((t) => t.id);

    // 4. Upsert Social Review
    // Using upsert on (user_id, place_id)
    const { data: review, error: upsertError } = await supabase
      .from("place_social_reviews")
      .upsert(
        {
          user_id: user.id,
          place_id: placeId,
          stars: rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, place_id" }
      )
      .select("id, place_id, stars")
      .single();

    if (upsertError) {
      throw new Error(`Error upserting review: ${upsertError.message}`);
    }

    // 5. Manage Tag Relations
    // We need to replace all existing tags for this review with the new ones.
    // Client-side transaction simulation: Delete all, then insert new.
    
    // Delete existing relations
    const { error: deleteError } = await supabase
      .from("place_review_tag_relations")
      .delete()
      .eq("review_id", review.id);

    if (deleteError) {
      throw new Error(`Error deleting old tags: ${deleteError.message}`);
    }

    // Insert new relations
    const relationsToInsert = tagIds.map((tagId) => ({
      review_id: review.id,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from("place_review_tag_relations")
      .insert(relationsToInsert);

    if (insertError) {
       // Potential Partial Failure Scenario: Review updated, tags deleted, but new tags failed.
       // In a real production environment with high integrity requirements, this might rely on a Postgres function.
       // However, given the context, we return the error.
       throw new Error(`Error inserting new tags: ${insertError.message}`);
    }

    // 6. Response
    return new Response(
      JSON.stringify({
        review_id: review.id,
        place_id: review.place_id,
        stars: review.stars,
        tags: selectedVibes,
        message: "Review saved successfully",
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Save Social Review Error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_server_error",
        message: err.message || "An unexpected error occurred",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
