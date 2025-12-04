/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { decryptMessage, getEncryptionKey } from "../_shared/encryption.ts";
import { getPlaceDetails } from "../_shared/foursquare/placeDetails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const USER_PHOTOS_BUCKET = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";
const SIGNED_URL_EXPIRES = 3600;
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
}

const authClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Prefer user-scoped client for RLS; fall back to service role if RLS blocks.
    const reader = serviceClient ?? userClient;

    const { data: rows, error: viewError } = await reader
      .from("chat_list")
      .select(
        "chat_id, match_id, chat_created_at, place_id, user_a, user_a_name, user_a_photo_url, user_b, user_b_name, user_b_photo_url, last_message_enc, last_message_iv, last_message_tag, last_message_at, user_a_unread, user_b_unread, first_message_at"
      )
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (viewError) {
      return new Response(
        JSON.stringify({
          error: "chats_fetch_failed",
          message: viewError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const signedPhotoMap = new Map<string, string | null>();
    if (serviceClient) {
      const photoItems = Array.from(
        new Set(
          (rows ?? [])
            .map((r) => {
              const isUserA = r.user_a === user.id;
              const path = isUserA ? r.user_b_photo_url : r.user_a_photo_url;
              const otherId = isUserA ? r.user_b : r.user_a;
              return path && otherId ? `${otherId}::${path}` : null;
            })
            .filter(Boolean) as string[]
        )
      );

      for (const item of photoItems) {
        const [otherId, path] = item.split("::");
        const { data: signed, error: signedError } = await serviceClient.storage
          .from(USER_PHOTOS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_EXPIRES);
        if (!signedError && signed?.signedUrl) {
          signedPhotoMap.set(otherId, signed.signedUrl);
        } else {
          signedPhotoMap.set(otherId, null);
        }
      }
    }

    // Get encryption key once for all messages
    const encryptionKey = await getEncryptionKey();

    // Fetch place names from Foursquare API
    const placeIds = Array.from(
      new Set(
        (rows ?? [])
          .map((r) => r.place_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );
    
    const placesMap = new Map<string, string>();
    if (placeIds.length > 0) {
      try {
        const places = await getPlaceDetails({ 
          fsq_ids: placeIds,
          userLat: 0,
          userLng: 0
        });
        places.forEach((place) => {
          placesMap.set(place.fsq_id, place.name);
        });
        
        // Log place IDs that weren't found
        const foundIds = new Set(places.map(p => p.fsq_id));
        const missingIds = placeIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
          console.log("Place IDs not found in Foursquare:", missingIds);
        }
      } catch (error) {
        console.error("Failed to fetch place names:", error);
      }
    }

    const chatsPromises =
      rows?.map(async (row: any) => {
        const isUserA = row.user_a === user.id;
        const otherUserId = isUserA ? row.user_b : row.user_a;
        const otherUserName = isUserA ? row.user_b_name : row.user_a_name;
        const otherPhotoPath = isUserA
          ? row.user_b_photo_url
          : row.user_a_photo_url;
        const unread = isUserA ? row.user_a_unread : row.user_b_unread;

        const otherPhotoUrl =
          otherPhotoPath == null
            ? null
            : signedPhotoMap.get(otherUserId) ?? null;

        // Decrypt last message if available
        let lastMessage: string | null = null;
        if (row.last_message_enc && row.last_message_iv && row.last_message_tag && encryptionKey) {
          try {
            lastMessage = await decryptMessage(
              row.last_message_enc,
              row.last_message_iv,
              row.last_message_tag,
              encryptionKey
            );
          } catch (error) {
            console.error("Failed to decrypt last message:", error);
            lastMessage = null;
          }
        }

        return {
          chat_id: row.chat_id,
          match_id: row.match_id,
          place_id: row.place_id ?? null,
          place_name: row.place_id ? (placesMap.get(row.place_id) ?? "Unknown Place") : null,
          other_user_id: otherUserId,
          other_user_name: otherUserName,
          other_user_photo_url: otherPhotoUrl,
          last_message: lastMessage,
          last_message_at: row.last_message_at ?? null,
          unread_count: unread ?? 0,
          chat_created_at: row.chat_created_at ?? null,
          first_message_at: row.first_message_at ?? null,
        };
      }) ?? [];

    const chats = await Promise.all(chatsPromises);

    const sorted = chats.sort((a, b) => {
      const aTime = a.last_message_at || a.chat_created_at || "";
      const bTime = b.last_message_at || b.chat_created_at || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return new Response(JSON.stringify({ chats: sorted }), {
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
