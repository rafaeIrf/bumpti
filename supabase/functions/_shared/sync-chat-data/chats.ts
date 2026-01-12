import { decryptMessage } from "../encryption.ts";
import type { SyncChanges } from "./types.ts";
import {
  fetchPhotosInBatch,
  signPhotoUrl,
  signPhotoUrlsInBatch,
} from "./media.ts";

export async function fetchChatsChanges(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  sinceDate: string | null,
  encryptionKey: CryptoKey,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
): Promise<SyncChanges> {
  const allChats = await fetchChatsFromRPC(
    supabase,
    userId,
    sinceDate,
    forceUpdates,
    usersWithPhotoUpdates
  );

  console.log("[Chats] Found:", allChats.length);

  const userIds = allChats.map((c: any) => c.other_user_id);
  const photosMap = await fetchPhotosInBatch(supabaseAdmin, userIds);

  const processedChats = await Promise.all(
    allChats.map((chat: any) =>
      processChat(chat, encryptionKey, photosMap, supabaseAdmin)
    )
  );

  return classifyChats(processedChats, sinceDate, forceUpdates, usersWithPhotoUpdates);
}

export async function fetchChatsForMediaRefresh(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  encryptionKey: CryptoKey
): Promise<any[]> {
  const allChats = await fetchChatsFromRPC(
    supabase,
    userId,
    null,
    true,
    []
  );

  if (!allChats.length) return [];

  const userIds = allChats.map((c: any) => c.other_user_id);
  const photosMap = await fetchPhotosInBatch(supabaseAdmin, userIds);
  const photoPaths = userIds
    .map((id: string) => photosMap.get(id))
    .filter(Boolean) as string[];
  const signedByPath = await signPhotoUrlsInBatch(supabaseAdmin, photoPaths);

  const signedByUserId = new Map<string, string | null>();
  userIds.forEach((id: string) => {
    const path = photosMap.get(id);
    if (!path) return;
    signedByUserId.set(id, signedByPath.get(path) ?? null);
  });

  return Promise.all(
    allChats.map((chat: any) =>
      processChatWithSignedMap(chat, encryptionKey, signedByUserId)
    )
  );
}

async function fetchChatsFromRPC(
  supabase: any,
  userId: string,
  sinceDate: string | null,
  forceUpdates: boolean,
  usersWithPhotoUpdates: string[]
) {
  const { data, error } = await supabase.rpc("get_user_chats_for_sync", {
    p_user_id: userId,
    p_since: forceUpdates ? null : sinceDate,
  });

  if (error) {
    console.error("[Chats] RPC error:", error);
    throw error;
  }

  let chats = data || [];

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
  const decryptedMessage = await decryptChatMessage(chat, encryptionKey);

  const photoPath = photosMap.get(chat.other_user_id) || chat.other_user_photo_url;
  const signedPhotoUrl = photoPath && !photoPath.startsWith("http")
    ? await signPhotoUrl(supabaseAdmin, photoPath)
    : photoPath;

  return buildChatPayload(chat, decryptedMessage, signedPhotoUrl ?? null);
}

async function processChatWithSignedMap(
  chat: any,
  encryptionKey: CryptoKey,
  signedPhotoMap: Map<string, string | null>
) {
  const decryptedMessage = await decryptChatMessage(chat, encryptionKey);

  const existingPhoto = chat.other_user_photo_url;
  const signedPhotoUrl =
    signedPhotoMap.get(chat.other_user_id) ??
    (typeof existingPhoto === "string" && existingPhoto.startsWith("http")
      ? existingPhoto
      : null);

  return buildChatPayload(chat, decryptedMessage, signedPhotoUrl);
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

async function decryptChatMessage(
  chat: any,
  encryptionKey: CryptoKey
): Promise<string> {
  if (!chat.last_message || !chat.last_message_iv || !chat.last_message_tag) {
    return chat.last_message;
  }

  try {
    return await decryptMessage(
      chat.last_message,
      chat.last_message_iv,
      chat.last_message_tag,
      encryptionKey
    );
  } catch (e) {
    console.error(`[Chat ${chat.chat_id}] Decrypt failed:`, e);
    return "Mensagem criptografada";
  }
}

function buildChatPayload(
  chat: any,
  decryptedMessage: string,
  signedPhotoUrl: string | null
) {
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
