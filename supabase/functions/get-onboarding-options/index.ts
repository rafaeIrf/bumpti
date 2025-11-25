/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const [
      { data: genders, error: gendersError },
      { data: intentions, error: intentionsError },
    ] = await Promise.all([
      supabase.from("gender_options").select("id,key").eq("active", true).order("id"),
      supabase.from("intention_options").select("id,key").eq("active", true).order("id"),
    ]);

    if (gendersError) throw gendersError;
    if (intentionsError) throw intentionsError;

    return new Response(
      JSON.stringify({
        genders: genders ?? [],
        intentions: intentions ?? [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("get-onboarding-options error:", error);
    return new Response(
      JSON.stringify({
        error: "failed_to_fetch_options",
        message: error?.message ?? "Unable to fetch onboarding options.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
