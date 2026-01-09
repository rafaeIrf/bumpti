/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptMessage, getEncryptionKey } from "../_shared/encryption.ts";

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

// ============================================================================
// TYPES
// ============================================================================

interface SyncChanges {
  created: any[];
  updated: any[];
  deleted: any[];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Auth
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

    // 2. Parse request
    const { last_pulled_at, force_updates = false } = await req.json();
    const sinceDate = last_pulled_at ? new Date(last_pulled_at).toISOString() : null;

    console.log("[Sync] Start:", { userId: user.id, sinceDate, force_updates });

    // 3. Detect photo updates
    const usersWithPhotoUpdates = sinceDate && !force_updates
      ? await detectPhotoUpdates(supabaseAdmin, user.id, sinceDate)
      : [];

    // 4. Fetch changes
    const changes = {
      matches: await fetchMatchesChanges(supabaseAdmin, user.id, sinceDate, force_updates, usersWithPhotoUpdates),
      chats: await fetchChatsChanges(supabase, supabaseAdmin, user.id, sinceDate, encryptionKey, force_updates, usersWithPhotoUpdates),
      messages: await fetchMessagesChanges(supabase, user.id, sinceDate, encryptionKey, force_updates),
    };

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

// ============================================================================
// PHOTO UPDATES DETECTION
// ============================================================================

async function detectPhotoUpdates(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string
): Promise<string[]> {
  try {
    // Buscar todos os matches ativos do usuário
    const { data: matches } = await supabaseAdmin
      .from("user_matches")
      .select("user_a, user_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq("status", "active");

    if (!matches?.length) return [];

    // Extrair IDs dos outros usuários (únicos)
    const otherUserIds = [...new Set(
      matches.map((m: any) => m.user_a === userId ? m.user_b : m.user_a)
    )];

    // Verificar se algum teve mudança em fotos (DELETE + INSERT = created_at novo)
    const { data: updatedPhotos } = await supabaseAdmin
      .from("profile_photos")
      .select("user_id")
      .in("user_id", otherUserIds)
      .gt("created_at", sinceDate);

    if (!updatedPhotos?.length) return [];

    const usersWithUpdates = [...new Set(updatedPhotos.map((p: any) => p.user_id))];
    console.log("[PhotoUpdates] Found:", usersWithUpdates.length, "users");
    
    return usersWithUpdates;
  } catch (error) {
    console.error("[PhotoUpdates] Error:", error);
    return [];
  }
}

// ============================================================================
// MATCHES SYNC
// ============================================================================

async function fetchMatchesChanges(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
): Promise<SyncChanges> {
  // Buscar matches (com filtro de data OU com photo updates)
  const matches = await fetchMatchesFromDB(
    supabaseAdmin,
    userId,
    sinceDate,
    forceUpdates,
    usersWithPhotoUpdates
  );

  // Filtrar: apenas matches SEM chat com mensagens
  const matchesWithoutMessages = matches.filter((m) => {
    const chatsData = m.chats;
    
    // Debug: log estrutura do campo chats
    console.log(`[Match ${m.id}] Raw chats data:`, JSON.stringify(chatsData));
    
    // Se não tem chats ou é array vazio → match sem chat → OK
    if (!chatsData || (Array.isArray(chatsData) && chatsData.length === 0)) {
      console.log(`[Match ${m.id}] NO CHAT - Include in matches ✓`);
      return true;
    }
    
    // Se tem chats, verificar se tem mensagens
    if (Array.isArray(chatsData) && chatsData.length > 0) {
      const firstChat = chatsData[0];
      const hasMessages = firstChat && firstChat.first_message_at !== null;
      console.log(`[Match ${m.id}] HAS CHAT with messages=${hasMessages} - ${hasMessages ? 'EXCLUDE ✗' : 'Include ✓'}`);
      return !hasMessages; // Retorna true apenas se NÃO tem mensagens
    }
    
    // Fallback: incluir por segurança
    console.log(`[Match ${m.id}] Unexpected format - Include by default`);
    return true;
  });

  console.log("[Matches] Total:", matches.length, "without messages:", matchesWithoutMessages.length);

  // Buscar fotos em batch (não um por um!)
  const userIds = matchesWithoutMessages.map((m) => 
    m.user_a === userId ? m.user_b : m.user_a
  );
  const photosMap = await fetchPhotosInBatch(supabaseAdmin, userIds);

  // Transformar e classificar
  return await transformAndClassifyMatches(
    matchesWithoutMessages,
    userId,
    sinceDate,
    forceUpdates,
    usersWithPhotoUpdates,
    photosMap,
    supabaseAdmin
  );
}

async function fetchMatchesFromDB(
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
) {
  let query = supabaseAdmin
    .from("user_matches")
    .select(`
      id, user_a, user_b, status, matched_at, unmatched_at,
      place_id, place_name, user_a_opened_at, user_b_opened_at,
      profile_a:profiles!user_a(id, name),
      profile_b:profiles!user_b(id, name),
      chats!inner(
        id,
        first_message_at
      )
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .is("chats.first_message_at", null);


  // Filtro de data: mudanças recentes OU photo updates
  if (sinceDate && !forceUpdates) {
    const dateFilter = `matched_at.gt.${sinceDate},unmatched_at.gt.${sinceDate},user_a_opened_at.gt.${sinceDate},user_b_opened_at.gt.${sinceDate}`;
    
    if (usersWithPhotoUpdates.length > 0) {
      // Incluir também matches com usuários que atualizaram fotos
      const userFilters = usersWithPhotoUpdates
        .map((uid) => `user_a.eq.${uid},user_b.eq.${uid}`)
        .join(",");
      query = query.or(`${dateFilter},${userFilters}`);
    } else {
      query = query.or(dateFilter);
    }
  }

  const { data, error } = await query.order("matched_at", { ascending: true });

  if (error) {
    console.error("[Matches] DB error:", error);
    throw error;
  }

  return data || [];
}

async function transformAndClassifyMatches(
  matches: any[],
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[],
  photosMap: Map<string, string>,
  supabaseAdmin: any
): Promise<SyncChanges> {
  const created: any[] = [];
  const updated: any[] = [];
  const deleted: any[] = [];

  for (const match of matches) {
    const isUserA = match.user_a === userId;
    const otherUserId = isUserA ? match.user_b : match.user_a;
    const otherProfile = isUserA ? match.profile_b : match.profile_a;
    const hasPhotoUpdate = usersWithPhotoUpdates.includes(otherUserId);

    // Assinar foto
    const photoPath = photosMap.get(otherUserId);
    const signedPhotoUrl = photoPath
      ? await signPhotoUrl(supabaseAdmin, photoPath)
      : null;

    // Transformar
    const timestamps = [
      match.matched_at,
      match.unmatched_at,
      match.user_a_opened_at,
      match.user_b_opened_at,
    ]
      .filter(Boolean)
      .map((t) => new Date(t).getTime());

    const transformed = {
      id: match.id,
      chat_id: match.chats?.id || null,
      user_a: match.user_a,
      user_b: match.user_b,
      status: match.status,
      matched_at: match.matched_at ? new Date(match.matched_at).getTime() : null,
      unmatched_at: match.unmatched_at ? new Date(match.unmatched_at).getTime() : null,
      place_id: match.place_id,
      user_a_opened_at: match.user_a_opened_at ? new Date(match.user_a_opened_at).getTime() : null,
      user_b_opened_at: match.user_b_opened_at ? new Date(match.user_b_opened_at).getTime() : null,
      synced_at: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
      other_user_id: otherProfile?.id,
      other_user_name: otherProfile?.name,
      other_user_photo_url: signedPhotoUrl,
      place_name: match.place_name,
    };

    // Classificar
    if (match.status === "unmatched" && sinceDate && !forceUpdates) {
      deleted.push(match.id);
    } else if (forceUpdates || hasPhotoUpdate) {
      updated.push(transformed);
    } else if (!sinceDate || new Date(match.matched_at).getTime() > new Date(sinceDate).getTime()) {
      created.push(transformed);
    } else {
      updated.push(transformed);
    }
  }

  return { created, updated, deleted };
}

// ============================================================================
// CHATS SYNC
// ============================================================================

async function fetchChatsChanges(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  encryptionKey: CryptoKey,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
): Promise<SyncChanges> {
  // Buscar chats via RPC (já filtra: first_message_at IS NOT NULL)
  const allChats = await fetchChatsFromRPC(
    supabase,
    userId,
    sinceDate,
    forceUpdates,
    usersWithPhotoUpdates
  );

  console.log("[Chats] Found:", allChats.length);

  // Buscar fotos em batch
  const userIds = allChats.map((c) => c.other_user_id);
  const photosMap = await fetchPhotosInBatch(supabaseAdmin, userIds);

  // Processar em paralelo (decrypt + sign)
  const processedChats = await Promise.all(
    allChats.map((chat) =>
      processChat(chat, encryptionKey, photosMap, supabaseAdmin)
    )
  );

  // Classificar
  return classifyChats(processedChats, sinceDate, forceUpdates, usersWithPhotoUpdates);
}

async function fetchChatsFromRPC(
  supabase: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
) {
  // Query principal
  const { data, error } = await supabase.rpc("get_user_chats_for_sync", {
    p_user_id: userId,
    p_since: forceUpdates ? null : sinceDate,
  });

  if (error) {
    console.error("[Chats] RPC error:", error);
    throw error;
  }

  let chats = data || [];

  // Se há photo updates, buscar chats adicionais
  if (usersWithPhotoUpdates.length > 0 && !forceUpdates) {
    const { data: allChatsData } = await supabase.rpc("get_user_chats_for_sync", {
      p_user_id: userId,
      p_since: null,
    });

    if (allChatsData) {
      const mainChatIds = new Set(chats.map((c: any) => c.chat_id));
      const additionalChats = allChatsData.filter(
        (c: any) =>
          usersWithPhotoUpdates.includes(c.other_user_id) &&
          !mainChatIds.has(c.chat_id)
      );
      chats = [...chats, ...additionalChats];
      console.log("[Chats] Added", additionalChats.length, "for photo updates");
    }
  }

  return chats;
}

async function processChat(
  chat: any,
  encryptionKey: CryptoKey,
  photosMap: Map<string, string>,
  supabaseAdmin: any
) {
  // Decrypt last message
  let decryptedMessage = chat.last_message;
  if (chat.last_message && chat.last_message_iv && chat.last_message_tag) {
    try {
      decryptedMessage = await decryptMessage(
        chat.last_message,
        chat.last_message_iv,
        chat.last_message_tag,
        encryptionKey
      );
    } catch (e) {
      console.error(`[Chat ${chat.chat_id}] Decrypt failed:`, e);
      decryptedMessage = "Mensagem criptografada";
    }
  }

  // Sign photo URL
  const photoPath = photosMap.get(chat.other_user_id) || chat.other_user_photo_url;
  const signedPhotoUrl = photoPath && !photoPath.startsWith("http")
    ? await signPhotoUrl(supabaseAdmin, photoPath)
    : photoPath;

  return {
    id: chat.chat_id,
    match_id: chat.match_id,
    created_at: new Date(chat.chat_created_at).getTime(),
    last_message_content: decryptedMessage,
    last_message_at: chat.last_message_at ? new Date(chat.last_message_at).getTime() : null,
    other_user_id: chat.other_user_id,
    other_user_name: chat.other_user_name,
    other_user_photo_url: signedPhotoUrl,
    place_id: chat.place_id,
    place_name: chat.place_name,
    unread_count: Number(chat.unread_count),
    synced_at: Date.now(),
  };
}

function classifyChats(
  chats: any[],
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
): SyncChanges {
  const created: any[] = [];
  const updated: any[] = [];

  for (const chat of chats) {
    const hasPhotoUpdate = usersWithPhotoUpdates.includes(chat.other_user_id);

    if (forceUpdates || hasPhotoUpdate) {
      updated.push(chat);
    } else if (!sinceDate) {
      created.push(chat);
    } else if (chat.created_at > new Date(sinceDate).getTime()) {
      created.push(chat);
    } else {
      updated.push(chat);
    }
  }

  return { created, updated, deleted: [] };
}

// ============================================================================
// MESSAGES SYNC
// ============================================================================

async function fetchMessagesChanges(
  supabase: any,
  userId: string,
  sinceDate: string | null,
  encryptionKey: CryptoKey,
  forceUpdates: boolean
): Promise<SyncChanges> {
  // Buscar chat IDs do usuário
  const chatIds = await getChatIdsForUser(supabase, userId);
  if (chatIds.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  // Buscar mensagens
  let query = supabase
    .from("messages")
    .select("id, chat_id, sender_id, content_enc, content_iv, content_tag, created_at, read_at")
    .in("chat_id", chatIds);

  if (sinceDate && !forceUpdates) {
    query = query.or(`created_at.gt.${sinceDate},read_at.gt.${sinceDate}`);
  }

  const { data, error } = await query.order("created_at", { ascending: true }).limit(1000);

  if (error) {
    console.error("[Messages] DB error:", error);
    throw error;
  }

  console.log("[Messages] Fetched:", data?.length || 0);

  // Decrypt e classificar
  const created: any[] = [];
  const updated: any[] = [];

  for (const msg of data || []) {
    try {
      const decryptedContent = await decryptMessage(
        msg.content_enc,
        msg.content_iv,
        msg.content_tag,
        encryptionKey
      );

      const createdAt = new Date(msg.created_at).getTime();
      const readAt = msg.read_at ? new Date(msg.read_at).getTime() : null;
      const syncedAt = readAt && readAt > createdAt ? readAt : createdAt;

      const transformed = {
        id: msg.id,
        chat_id: msg.chat_id,
        sender_id: msg.sender_id,
        content: decryptedContent,
        created_at: createdAt,
        read_at: readAt,
        status: "sent",
        synced_at: syncedAt,
      };

      if (forceUpdates) {
        updated.push(transformed);
      } else if (!sinceDate || createdAt > new Date(sinceDate).getTime()) {
        created.push(transformed);
      } else {
        updated.push(transformed);
      }
    } catch (e) {
      console.error("[Message]", msg.id, "decrypt failed:", e);
    }
  }

  return { created, updated, deleted: [] };
}

async function getChatIdsForUser(supabase: any, userId: string): Promise<string[]> {
  const { data: matches } = await supabase
    .from("user_matches")
    .select("id")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (!matches?.length) return [];

  const matchIds = matches.map((m: any) => m.id);

  const { data: chats } = await supabase
    .from("chats")
    .select("id")
    .in("match_id", matchIds);

  return (chats || []).map((c: any) => c.id);
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Busca fotos de múltiplos usuários em uma única query (batch)
 */
async function fetchPhotosInBatch(
  supabaseAdmin: any,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const uniqueUserIds = [...new Set(userIds)];

  const { data, error } = await supabaseAdmin
    .from("profile_photos")
    .select("user_id, url")
    .in("user_id", uniqueUserIds)
    .eq("position", 0);

  if (error) {
    console.error("[Photos] Batch fetch error:", error);
    return new Map();
  }

  return new Map((data || []).map((p: any) => [p.user_id, p.url]));
}

/**
 * Assina uma URL de foto com o Supabase Storage
 */
async function signPhotoUrl(
  supabaseAdmin: any,
  photoPath: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("user_photos")
      .createSignedUrl(photoPath, 3600);

    if (error || !data?.signedUrl) {
      console.error("[Sign] Error for", photoPath, ":", error);
      return null;
    }

    return data.signedUrl;
  } catch (e) {
    console.error("[Sign] Exception for", photoPath, ":", e);
    return null;
  }
}

/**
 * Helper para retornar JSON response
 */
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Helper para contar items em SyncChanges
 */
function counts(changes: SyncChanges) {
  return {
    created: changes.created.length,
    updated: changes.updated.length,
    deleted: changes.deleted.length,
  };
}
