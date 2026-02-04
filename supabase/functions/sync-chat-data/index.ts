/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getEncryptionKey } from "../_shared/encryption.ts";
import {
  fetchChatsChanges,
  fetchChatsForMediaRefresh,
} from "../_shared/sync-chat-data/chats.ts";
import {
  fetchMatchesChanges,
  fetchMatchesForMediaRefresh,
  fetchUnmatchedChatIdsForDeletion,
} from "../_shared/sync-chat-data/matches.ts";
import { mergeUpdated } from "../_shared/sync-chat-data/media.ts";
import { fetchMessagesChanges } from "../_shared/sync-chat-data/messages.ts";
import { detectPhotoUpdates } from "../_shared/sync-chat-data/photo-updates.ts";
import {
  counts,
  jsonResponse,
  optionsResponse,
} from "../_shared/sync-chat-data/response.ts";

/**
 * Unified Sync Edge Function for WatermelonDB
 *
 * POST /sync-chat-data
 * Body: { last_pulled_at: number | null, force_updates?: boolean }
 *
 * Response: {
 *   changes: {
 *     matches: { created: [], updated: [], deleted: [] },
 *     chats: { created: [], updated: [], deleted: [] },
 *     messages: { created: [], updated: [], deleted: [] }
 *   },
 *   timestamp: number
 * }
 */

const MEDIA_REFRESH_THRESHOLD = 20 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = await getEncryptionKey();

    if (!encryptionKey) {
      console.error("Encryption key not found");
      return jsonResponse({ error: "internal_server_error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const { last_pulled_at, force_updates = false, local_chat_ids = [], local_match_ids = [] } = await req.json();
    const sinceDate = last_pulled_at ? new Date(last_pulled_at).toISOString() : null;
    const shouldRefreshMedia =
      typeof last_pulled_at === "number" &&
      Date.now() - last_pulled_at > MEDIA_REFRESH_THRESHOLD;

    console.log("[Sync] Start:", { userId: user.id, sinceDate, force_updates, localChatIds: local_chat_ids.length, localMatchIds: local_match_ids.length });

    const usersWithPhotoUpdates = sinceDate && !force_updates && !shouldRefreshMedia
      ? await detectPhotoUpdates(supabaseAdmin, user.id, sinceDate)
      : [];

    const changes = {
      matches: await fetchMatchesChanges(
        supabaseAdmin,
        user.id,
        sinceDate,
        force_updates,
        usersWithPhotoUpdates,
        local_match_ids
      ),
      chats: await fetchChatsChanges(
        supabase,
        supabaseAdmin,
        user.id,
        sinceDate,
        encryptionKey,
        force_updates,
        usersWithPhotoUpdates,
        local_chat_ids
      ),
      messages: await fetchMessagesChanges(
        supabase,
        user.id,
        sinceDate,
        encryptionKey,
        force_updates
      ),
    };

    const unmatchedChatIds = await fetchUnmatchedChatIdsForDeletion(
      supabaseAdmin,
      user.id,
      sinceDate,
      force_updates
    );

    if (unmatchedChatIds.length > 0) {
      changes.chats.deleted = Array.from(
        new Set([...(changes.chats.deleted || []), ...unmatchedChatIds])
      );
    }

    if (shouldRefreshMedia) {
      const refreshedMatches = await fetchMatchesForMediaRefresh(
        supabaseAdmin,
        user.id
      );
      const refreshedChats = await fetchChatsForMediaRefresh(
        supabase,
        supabaseAdmin,
        user.id,
        encryptionKey
      );

      changes.matches.updated = mergeUpdated(
        changes.matches.updated,
        refreshedMatches
      );
      changes.chats.updated = mergeUpdated(
        changes.chats.updated,
        refreshedChats
      );
    }

    console.log("[Sync] Complete:", {
      matches: counts(changes.matches),
      chats: counts(changes.chats),
      messages: counts(changes.messages),
    });

    return jsonResponse({ changes, timestamp: Date.now() });
  } catch (error) {
    console.error("[Sync] Error:", error);
    return jsonResponse({ error: "internal_server_error", details: error.message }, 500);
  }
});
