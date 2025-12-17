import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();
    const { place_id } = await req.json();

    if (!place_id) {
      return new Response(JSON.stringify({ error: "Missing place_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Run counts in parallel
    const [activeRes, recentRes, favoritesRes, placeRes] = await Promise.all([
      // 1. Active Presences
      supabase
        .from("user_presences")
        .select("*", { count: "exact", head: true })
        .eq("place_id", place_id)
        .eq("active", true)
        .is("ended_at", null)
        .gt("expires_at", now.toISOString()),

      // 2. Recent 24h
      supabase
        .from("user_presences")
        .select("*", { count: "exact", head: true })
        .eq("place_id", place_id)
        .gt("entered_at", yesterday.toISOString()),

      // 3. Favorites
      supabase
        .from("profile_favorite_places")
        .select("*", { count: "exact", head: true })
        .eq("place_id", place_id),
      
      // 4. Get current structural score
      supabase
        .from("places")
        .select("structural_score")
        .eq("id", place_id)
        .single(),
    ]);

    if (placeRes.error) throw placeRes.error;

    const active_presences = activeRes.count ?? 0;
    const recent_24h = recentRes.count ?? 0;
    const favorites = favoritesRes.count ?? 0;
    const structural_score = placeRes.data.structural_score ?? 0;

    // Calculate score
    const social_score = (active_presences * 10) + (recent_24h * 5) + (favorites * 2);
    const total_score = structural_score + social_score;

    // Prepare update
    const updates: any = {
      social_score,
      total_score,
      updated_at: now.toISOString(),
    };

    if (active_presences > 0) {
      updates.last_activity_at = now.toISOString();
    }

    const { error: updateError } = await supabase
      .from("places")
      .update(updates)
      .eq("id", place_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        place_id,
        social_score,
        total_score,
        active_presences,
        recent_24h,
        favorites,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error recalculating score:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
