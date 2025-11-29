/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: matches, error: matchesError } = await supabase
      .from("user_matches")
      .select("id, user_a, user_b, status, matched_at")
      .eq("status", "active")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (matchesError) {
      return new Response(
        JSON.stringify({
          error: "matches_fetch_failed",
          message: matchesError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const activeMatches = (matches ?? []).filter(
      (m) => m.status === "active"
    );

    if (!activeMatches.length) {
      return new Response(JSON.stringify({ chats: [] }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const matchIds = activeMatches.map((m) => m.id);

    const { data: chats, error: chatsError } = await supabase
      .from("chats")
      .select("id, match_id, created_at")
      .in("match_id", matchIds);

    if (chatsError) {
      return new Response(
        JSON.stringify({
          error: "chats_fetch_failed",
          message: chatsError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const chatsByMatch = new Map<string, any>();
    (chats ?? []).forEach((chat) => {
      if (chat?.match_id) {
        chatsByMatch.set(chat.match_id, chat);
      }
    });

    const otherUserIds = new Set<string>();
    const chatEntries: {
      chat: any;
      match: any;
      otherUserId: string;
    }[] = [];

    activeMatches.forEach((match) => {
      const chat = chatsByMatch.get(match.id);
      if (!chat) return;
      const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;
      otherUserIds.add(otherUserId);
      chatEntries.push({ chat, match, otherUserId });
    });

    if (!chatEntries.length) {
      return new Response(JSON.stringify({ chats: [] }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, bio")
      .in("id", Array.from(otherUserIds));

    if (profilesError) {
      return new Response(
        JSON.stringify({
          error: "profiles_fetch_failed",
          message: profilesError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const profilesById = new Map<string, any>();
    (profiles ?? []).forEach((p) => {
      if (p?.id) profilesById.set(p.id, p);
    });

    const chatsWithMessages = await Promise.all(
      chatEntries.map(async ({ chat, match, otherUserId }) => {
        const { data: lastMsg, error: lastMsgError } = await supabase
          .from("messages")
          .select("id, chat_id, sender_id, content, created_at")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMsgError) {
          return { error: lastMsgError, chatId: chat.id };
        }

        return {
          chat_id: chat.id,
          match_id: match.id,
          other_user: profilesById.get(otherUserId) ?? {
            id: otherUserId,
            name: null,
            bio: null,
          },
          last_message: lastMsg ?? null,
          created_at: chat.created_at,
          matched_at: match.matched_at ?? null,
        };
      })
    );

    const errored = chatsWithMessages.find((c) => (c as any).error);
    if (errored) {
      return new Response(
        JSON.stringify({
          error: "messages_fetch_failed",
          message: (errored as any).error.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const sortedChats = (chatsWithMessages as any[]).sort((a, b) => {
      const aTime = a.last_message?.created_at || a.matched_at || a.created_at;
      const bTime = b.last_message?.created_at || b.matched_at || b.created_at;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return new Response(JSON.stringify({ chats: sortedChats }), {
      status: 200,
      headers: corsHeaders,
    });
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
