/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SIGNED_URL_EXPIRES = 60 * 60 * 24;

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  return new Date(value).getTime();
}

async function fetchPrimaryPhotoPath(
  dbClient: any,
  userId: string
): Promise<string | null> {
  const { data } = await dbClient
    .from("profile_photos")
    .select("url")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.url ?? null;
}

async function buildMatchPayload(params: {
  dbClient: any;
  storageClient: any;
  matchId: string;
  recipientId: string;
}): Promise<Record<string, any> | null> {
  const { dbClient, storageClient, matchId, recipientId } = params;
  const { data: matchRow, error } = await dbClient
    .from("user_matches")
    .select(`
      id, user_a, user_b, status, matched_at, unmatched_at,
      place_id, place_name, user_a_opened_at, user_b_opened_at,
      match_origin, match_metadata,
      profile_a:profiles!user_a(id, name),
      profile_b:profiles!user_b(id, name),
      chats(
        id,
        created_at,
        first_message_at
      )
    `)
    .eq("id", matchId)
    .maybeSingle();

  if (error || !matchRow) return null;

  const isUserA = matchRow.user_a === recipientId;
  const otherUserId = isUserA ? matchRow.user_b : matchRow.user_a;
  const otherProfile = isUserA ? matchRow.profile_b : matchRow.profile_a;

  const photoPath = await fetchPrimaryPhotoPath(dbClient, otherUserId);
  let signedPhotoUrl: string | null = null;
  if (photoPath) {
    const { data: signed } = await storageClient.storage
      .from("user_photos")
      .createSignedUrl(photoPath, SIGNED_URL_EXPIRES);
    signedPhotoUrl = signed?.signedUrl ?? null;
  }

  const chatData = Array.isArray(matchRow.chats)
    ? matchRow.chats[0]
    : matchRow.chats;

  const timestamps = [
    toTimestamp(matchRow.matched_at),
    toTimestamp(matchRow.unmatched_at),
    toTimestamp(matchRow.user_a_opened_at),
    toTimestamp(matchRow.user_b_opened_at),
  ]
    .filter((t): t is number => t != null);

  return {
    id: matchRow.id,
    chat_id: chatData?.id ?? null,
    chat_created_at: chatData?.created_at
      ? toTimestamp(chatData.created_at)
      : null,
    first_message_at: chatData?.first_message_at
      ? toTimestamp(chatData.first_message_at)
      : null,
    user_a: matchRow.user_a,
    user_b: matchRow.user_b,
    status: matchRow.status,
    matched_at: toTimestamp(matchRow.matched_at),
    unmatched_at: toTimestamp(matchRow.unmatched_at),
    place_id: matchRow.place_id,
    place_name: matchRow.place_name,
    user_a_opened_at: toTimestamp(matchRow.user_a_opened_at),
    user_b_opened_at: toTimestamp(matchRow.user_b_opened_at),
    synced_at: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
    other_user_id: otherUserId,
    other_user_name: otherProfile?.name ?? null,
    other_user_photo_url: signedPhotoUrl,
    match_origin: matchRow.match_origin ?? null,
    match_metadata: matchRow.match_metadata ? JSON.stringify(matchRow.match_metadata) : null,
  };
}

async function broadcastMatch(params: {
  realtimeClient: any;
  recipientId: string;
  payload: Record<string, any>;
}): Promise<void> {
  const { realtimeClient, recipientId, payload } = params;
  const channel = realtimeClient.channel(`user:${recipientId}`);
  await channel.send({
    type: "broadcast",
    event: "NEW_MATCH",
    payload,
  });
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

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    const dbClient = serviceClient || authClient;
    const realtimeClient = serviceClient || authClient;
    const storageClient = serviceClient || authClient;
    if (!serviceClient) {
      console.warn(
        "interact-user: SUPABASE_SERVICE_ROLE_KEY not set, falling back to anon client with RLS"
      );
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => null);
    const isBatch = Array.isArray(body?.batch);
    const items = isBatch
      ? body.batch
      : [
          {
            to_user_id: body?.to_user_id,
            action: body?.action,
            place_id: body?.place_id,
            // Optional: 'regular' for frequentadores surfaced by get_eligible_regulars_at_place
            match_origin_override: body?.match_origin_override ?? null,
          },
        ];

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_batch" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    for (const item of items) {
      if (!item?.to_user_id || typeof item.to_user_id !== "string") {
        return new Response(JSON.stringify({ error: "invalid_to_user_id" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (item.to_user_id === user.id) {
        return new Response(
          JSON.stringify({ error: "cannot_interact_with_self" }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (item.action !== "like" && item.action !== "dislike") {
        return new Response(JSON.stringify({ error: "invalid_action" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    const results: {
      target_user_id: string;
      action: "like" | "dislike";
      status: "ok" | "error";
      is_match?: boolean;
      match_id?: string | null;
      error?: string;
    }[] = [];

    const likes = items.filter((item) => item.action === "like");
    const dislikes = items.filter((item) => item.action === "dislike");

    if (dislikes.length > 0) {
      const dislikeRows = dislikes.map((item) => ({
        from_user_id: user.id,
        to_user_id: item.to_user_id,
        action: "dislike",
        action_expires_at: null,
        place_id: item.place_id ?? null,
      }));

      const { error: dislikeError } = await dbClient
        .from("user_interactions")
        .upsert(dislikeRows, {
          onConflict: "from_user_id,to_user_id",
          ignoreDuplicates: false,
        });

      for (const item of dislikes) {
        if (dislikeError) {
          results.push({
            target_user_id: item.to_user_id,
            action: "dislike",
            status: "error",
            error: dislikeError.message,
          });
          continue;
        }

        const { data: existingMatch, error: matchLookupError } = await dbClient
          .from("user_matches")
          .select("id,status")
          .or(
            `and(user_a.eq.${user.id},user_b.eq.${item.to_user_id}),and(user_a.eq.${item.to_user_id},user_b.eq.${user.id})`
          )
          .eq("status", "active")
          .maybeSingle();

        if (matchLookupError) {
          results.push({
            target_user_id: item.to_user_id,
            action: "dislike",
            status: "error",
            error: matchLookupError.message,
          });
          continue;
        }

        if (existingMatch?.id) {
          const { error: unmatchError } = await dbClient
            .from("user_matches")
            .update({ status: "unmatched", unmatched_at: new Date().toISOString() })
            .eq("id", existingMatch.id);

          if (unmatchError) {
            results.push({
              target_user_id: item.to_user_id,
              action: "dislike",
              status: "error",
              error: unmatchError.message,
            });
            continue;
          }
        }

        results.push({
          target_user_id: item.to_user_id,
          action: "dislike",
          status: "ok",
        });
      }
    }

    for (const item of likes) {
      try {
        const { data: incomingLike, error: incomingLikeError } = await dbClient
          .from("user_interactions")
          .select("id")
          .eq("from_user_id", item.to_user_id)
          .eq("to_user_id", user.id)
          .eq("action", "like")
          .gt("action_expires_at", new Date().toISOString())
          .maybeSingle();

        if (incomingLikeError) {
          console.error("Error checking incoming like:", incomingLikeError);
        }

        // incomingLike is used below only for match detection — no presence guard needed.
        // The encounter itself already validates both users were at the location.

        const expiresAt = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();

        // Build the interaction row — include match_origin_override when present
        // (only 'regular' is a valid value; the DB trigger validates allowed values)
        const interactionRow: Record<string, unknown> = {
          from_user_id: user.id,
          to_user_id: item.to_user_id,
          action: "like",
          action_expires_at: expiresAt,
          place_id: item.place_id ?? null,
        };
        if (item.match_origin_override) {
          interactionRow.match_origin_override = item.match_origin_override;
        }

        const { error: likeError } = await dbClient
          .from("user_interactions")
          .upsert(interactionRow, {
            onConflict: "from_user_id,to_user_id",
            ignoreDuplicates: false,
          });

        if (likeError) {
          results.push({
            target_user_id: item.to_user_id,
            action: "like",
            status: "error",
            error: likeError.message,
          });
          continue;
        }

        const { data: matchRow, error: matchError } = await dbClient
          .from("user_matches")
          .select("id")
          .eq("status", "active")
          .or(
            `and(user_a.eq.${user.id},user_b.eq.${item.to_user_id}),and(user_a.eq.${item.to_user_id},user_b.eq.${user.id})`
          )
          .maybeSingle();

        if (matchError) {
          results.push({
            target_user_id: item.to_user_id,
            action: "like",
            status: "error",
            error: matchError.message,
          });
          continue;
        }

        if (matchRow?.id) {
          try {
            const [senderPayload, recipientPayload] = await Promise.all([
              buildMatchPayload({
                dbClient,
                storageClient,
                matchId: matchRow.id,
                recipientId: user.id,
              }),
              buildMatchPayload({
                dbClient,
                storageClient,
                matchId: matchRow.id,
                recipientId: item.to_user_id,
              }),
            ]);

            const broadcasts: Promise<void>[] = [];
            if (senderPayload) {
              broadcasts.push(
                broadcastMatch({
                  realtimeClient,
                  recipientId: user.id,
                  payload: senderPayload,
                })
              );
            }
            if (recipientPayload) {
              broadcasts.push(
                broadcastMatch({
                  realtimeClient,
                  recipientId: item.to_user_id,
                  payload: recipientPayload,
                })
              );
            }
            await Promise.all(broadcasts);
          } catch (broadcastError) {
            console.error("Failed to broadcast NEW_MATCH:", broadcastError);
          }
        }

        results.push({
          target_user_id: item.to_user_id,
          action: "like",
          status: "ok",
          is_match: Boolean(matchRow),
          match_id: matchRow?.id ?? null,
        });
      } catch (error) {
        results.push({
          target_user_id: item.to_user_id,
          action: "like",
          status: "error",
          error: error?.message ?? "like_failed",
        });
      }
    }

    // Clean up user_encounters for successfully processed interactions
    const successfulOtherIds = results
      .filter((r) => r.status === "ok")
      .map((r) => r.target_user_id);

    if (successfulOtherIds.length > 0) {
      for (const otherId of successfulOtherIds) {
        await dbClient
          .from("user_encounters")
          .delete()
          .or(
            `and(user_a_id.eq.${user.id},user_b_id.eq.${otherId}),and(user_a_id.eq.${otherId},user_b_id.eq.${user.id})`
          )
          .then(({ error: delErr }: any) => {
            if (delErr) console.error("Failed to delete encounter:", delErr);
          });
      }
    }

    if (isBatch) {
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const single = results[0];
    if (!single || single.status === "error") {
      return new Response(
        JSON.stringify({ error: single?.error ?? "interaction_failed" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (single.action === "like") {
      return new Response(
        JSON.stringify({
          status: "liked",
          match: Boolean(single.is_match),
          match_id: single.match_id ?? null,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ status: "disliked" }), {
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
