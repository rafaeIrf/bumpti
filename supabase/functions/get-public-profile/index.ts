/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getPublicProfile } from "../_shared/getPublicProfile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabaseService = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
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
    // Verificar autenticação do usuário que está solicitando
    const supabaseClient = createClient(supabaseUrl, serviceKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user?.id) {
      throw new Error(userError?.message ?? "User not found");
    }

    // Obter userId do body
    const body = await req.json();
    const targetUserId = body?.userId;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "Missing userId in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar perfil público do usuário alvo
    const profile = await getPublicProfile(
      supabaseClient,
      supabaseService,
      targetUserId
    );

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "not_found", message: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-public-profile error:", error);
    const message = error?.message ?? "Unable to fetch profile.";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: "fetch_profile_failed", message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

