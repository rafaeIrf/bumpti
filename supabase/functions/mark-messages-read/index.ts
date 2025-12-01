/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_SERVICE_ROLE_KEY env var",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => null);
    const chatId = body?.chat_id;

    if (!chatId || typeof chatId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_chat_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate chat belongs to user via match relation
    const { data: chatRow, error: chatError } = await userClient
      .from("chats")
      .select("match_id")
      .eq("id", chatId)
      .maybeSingle();

    if (chatError) {
      return new Response(
        JSON.stringify({ error: "chat_lookup_failed", message: chatError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!chatRow?.match_id) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data: matchRow, error: matchError } = await userClient
      .from("user_matches")
      .select("user_a, user_b, user_a_opened_at, user_b_opened_at")
      .eq("id", chatRow.match_id)
      .maybeSingle();

    if (matchError) {
      return new Response(
        JSON.stringify({ error: "match_lookup_failed", message: matchError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!matchRow || (matchRow.user_a !== user.id && matchRow.user_b !== user.id)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Use service role to ensure update passes RLS after validation
    const { data: updatedRows, error: updateError } = await serviceClient
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .neq("sender_id", user.id)
      .is("read_at", null)
      .select("id");

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: "update_failed",
          message: updateError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const updatedMessages = Array.isArray(updatedRows) ? updatedRows.length : 0;

    return new Response(
      JSON.stringify({ updated_messages: updatedMessages }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
