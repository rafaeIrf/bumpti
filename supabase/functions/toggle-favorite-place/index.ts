/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "unauthorized", message: "Missing access token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId : null;
    const action = body.action === "add" || body.action === "remove" ? body.action : null;

    if (!placeId || !action) {
      return new Response(
        JSON.stringify({ error: "invalid_payload", message: "placeId and action are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      throw new Error(userError?.message ?? "User not found");
    }

    if (action === "add") {
      const { error } = await supabase
        .from("profile_favorite_places")
        .insert({ user_id: user.id, place_id: placeId });

      if (error && error.code !== "23505") {
        throw error;
      }
    } else if (action === "remove") {
      const { error } = await supabase
        .from("profile_favorite_places")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", placeId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("toggle-favorite-place error:", error);
    return new Response(
      JSON.stringify({
        error: "favorite_toggle_failed",
        message: error?.message ?? "Unable to update favorite.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
