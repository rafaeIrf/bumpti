/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireAuth(req);

    const body = await req.json();
    const { favorite_places, nearby_activity, messages, matches, likes } = body;

    // Construct update data, filtering undefined values to allow partial updates if needed
    // However, the requirement says "UPDATE registro se existir (upsert)"
    const settings: Record<string, boolean> = {};
    if (typeof favorite_places === "boolean") settings.favorite_places = favorite_places;
    if (typeof nearby_activity === "boolean") settings.nearby_activity = nearby_activity;
    if (typeof messages === "boolean") settings.messages = messages;
    if (typeof matches === "boolean") settings.matches = matches;
    if (typeof likes === "boolean") settings.likes = likes;
    settings.updated_at = new Date().toISOString() as any; // Type casting for postgres timestamp

    // Upsert into notification_settings
    const { data, error } = await supabase
      .from("notification_settings")
      .upsert({
        user_id: user.id,
        ...settings
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === "Unauthorized" ? 401 : 500,
      headers: corsHeaders,
    });
  }
});
