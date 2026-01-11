import { decryptMessage } from "../encryption.ts";
import type { SyncChanges } from "./types.ts";

export async function fetchMessagesChanges(
  supabase: any,
  userId: string,
  sinceDate: string | null,
  encryptionKey: CryptoKey,
  forceUpdates: boolean
): Promise<SyncChanges> {
  const chatIds = await getChatIdsForUser(supabase, userId);
  if (chatIds.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

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

async function getChatIdsForUser(
  supabase: any,
  userId: string
): Promise<string[]> {
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
