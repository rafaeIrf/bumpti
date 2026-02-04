import { logger } from '@/utils/logger';
import { Database, Q } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { pullChanges } from './pullChanges';
import { pushChanges } from './pushChanges';
import { getSyncTimestamps, updateSyncTimestamps } from './types';

let syncingPromise: Promise<void> | null = null;

/**
 * Detecta registros locais que não existem mais no backend (force sync)
 * Marca como deletados para manter consistência
 */
async function detectMissingRecords(database: Database, changes: any): Promise<any> {
  try {
    // Buscar todos os IDs locais
    const localMatches = await database.collections.get('matches').query().fetch();
    const localChats = await database.collections.get('chats').query().fetch();
    const localMessages = await database.collections.get('messages').query().fetch();

    const localMatchIds = new Set(localMatches.map((m: any) => m.id));
    const localChatIds = new Set(localChats.map((c: any) => c.id));
    const localMessageIds = new Set(localMessages.map((m: any) => m.id));

    // IDs retornados pelo backend (created + updated)
    const backendMatchIds = new Set([
      ...(changes.matches?.created || []).map((m: any) => m.id),
      ...(changes.matches?.updated || []).map((m: any) => m.id),
    ]);
    const backendChatIds = new Set([
      ...(changes.chats?.created || []).map((c: any) => c.id),
      ...(changes.chats?.updated || []).map((c: any) => c.id),
    ]);
    const backendMessageIds = new Set([
      ...(changes.messages?.created || []).map((m: any) => m.id),
      ...(changes.messages?.updated || []).map((m: any) => m.id),
    ]);

    // IDs que existem localmente mas não no backend → deletar
    const matchesToDelete = Array.from(localMatchIds).filter((id) => !backendMatchIds.has(id));
    const chatsToDelete = Array.from(localChatIds).filter((id) => !backendChatIds.has(id));
    const messagesToDelete = Array.from(localMessageIds).filter((id) => !backendMessageIds.has(id));

    if (matchesToDelete.length > 0 || chatsToDelete.length > 0 || messagesToDelete.length > 0) {
      // Garantir que os arrays existam
      if (!changes.matches) changes.matches = { created: [], updated: [], deleted: [] };
      if (!changes.chats) changes.chats = { created: [], updated: [], deleted: [] };
      if (!changes.messages) changes.messages = { created: [], updated: [], deleted: [] };

      // Adicionar aos arrays de deleted
      changes.matches.deleted = [...(changes.matches.deleted || []), ...matchesToDelete];
      changes.chats.deleted = [...(changes.chats.deleted || []), ...chatsToDelete];
      changes.messages.deleted = [...(changes.messages.deleted || []), ...messagesToDelete];
    }

    return changes;
  } catch (error) {
    logger.error('Failed to detect missing records:', error);
    return changes;
  }
}

/**
 * Remove registros duplicados de todas as coleções
 * Útil em full sync onde o backend retorna TUDO como "created"
 */
async function dedupeExistingRecords(database: Database, changes: any) {
  try {
    // Dedupe matches
    const createdMatches = changes?.matches?.created;
    if (createdMatches?.length) {
      const ids = createdMatches.map((m: any) => m.id);
      const collection = database.collections.get('matches');
      const existing = await collection.query(Q.where('id', Q.oneOf(ids))).fetch();
      const existingIds = new Set(existing.map((m: any) => m.id));
      
      if (existingIds.size > 0) {
        const filtered = createdMatches.filter((m: any) => !existingIds.has(m.id));
        // Move duplicados para "updated" ao invés de "created"
        const duplicates = createdMatches.filter((m: any) => existingIds.has(m.id));
        changes.matches.created = filtered;
        changes.matches.updated = [...(changes.matches.updated || []), ...duplicates];
        logger.log(`Deduped ${existingIds.size} matches (moved to updated)`);
      }
    }

    // Dedupe chats
    const createdChats = changes?.chats?.created;
    if (createdChats?.length) {
      const ids = createdChats.map((c: any) => c.id);
      const collection = database.collections.get('chats');
      const existing = await collection.query(Q.where('id', Q.oneOf(ids))).fetch();
      const existingIds = new Set(existing.map((c: any) => c.id));
      
      if (existingIds.size > 0) {
        const filtered = createdChats.filter((c: any) => !existingIds.has(c.id));
        const duplicates = createdChats.filter((c: any) => existingIds.has(c.id));
        changes.chats.created = filtered;
        changes.chats.updated = [...(changes.chats.updated || []), ...duplicates];
        logger.log(`Deduped ${existingIds.size} chats (moved to updated)`);
      }
    }

    // Dedupe messages
    const createdMessages = changes?.messages?.created;
    if (createdMessages?.length) {
    const ids = createdMessages.map((m: any) => m.id);
    const collection = database.collections.get('messages');
    const existing = await collection.query(Q.where('id', Q.oneOf(ids))).fetch();
    const existingIds = new Set(existing.map((m: any) => m.id));

      if (existingIds.size > 0) {
    const filtered = createdMessages.filter((m: any) => !existingIds.has(m.id));
        const duplicates = createdMessages.filter((m: any) => existingIds.has(m.id));
    changes.messages.created = filtered;
        changes.messages.updated = [...(changes.messages.updated || []), ...duplicates];
        logger.log(`Deduped ${existingIds.size} messages (moved to updated)`);
      }
    }

    return changes;
  } catch (error) {
    logger.error('Failed to dedupe records:', error);
    return changes;
  }
}

/**
 * Sincroniza o banco de dados local com o backend
 * Usa WatermelonDB sync engine
 * 
 * @param database - Instância do WatermelonDB
 * @param forceFullSync - Se true, ignora lastPulledAt e puxa todos os dados
 */
export async function syncDatabase(database: Database, forceFullSync: boolean = false): Promise<void> {
  if (syncingPromise) {
    logger.log('⏳ Sync already in progress, skipping new sync request');
    return syncingPromise;
  }

  syncingPromise = (async () => {
    try {
      let deletedChatIds: string[] = [];

      if (forceFullSync) {
        logger.log('🔄 Starting FULL database synchronization (ignoring lastPulledAt)...');
      } else {
        logger.log('🔄 Starting incremental database synchronization...');
      }

      const { lastPulledAt } = await getSyncTimestamps();

      await synchronize({
        database,
        pullChanges: async ({ lastPulledAt: serverLastPulledAt }) => {
          // Se forceFullSync, passa null para puxar todos os dados
          const timestamp = forceFullSync ? null : (lastPulledAt || serverLastPulledAt || null);
          const { changes, timestamp: newTimestamp } = await pullChanges(timestamp, database);

          // Se for force sync, detectar registros locais que não existem mais no backend
          let processedChanges = changes;
          if (forceFullSync) {
            processedChanges = await detectMissingRecords(database, changes);
          }

          // Evitar erro de criação duplicada (já recebida via broadcast ou existente)
          // Move registros duplicados de "created" para "updated"
          const dedupedChanges = await dedupeExistingRecords(database, processedChanges);

          deletedChatIds = [
            ...(dedupedChanges.chats?.deleted || []),
            ...deletedChatIds,
          ];

          await updateSyncTimestamps({ lastPulledAt: newTimestamp });

          return { changes: dedupedChanges, timestamp: newTimestamp };
        },
        pushChanges: async ({ changes, lastPulledAt: serverLastPulledAt }) => {
          const timestamp = lastPulledAt || serverLastPulledAt || Date.now();
          const { timestamp: newTimestamp } = await pushChanges(changes, timestamp);
          
          await updateSyncTimestamps({ lastPushedAt: newTimestamp });
        },
        migrationsEnabledAtVersion: 1,
      });

      if (deletedChatIds.length > 0) {
        const uniqueDeletedChatIds = Array.from(new Set(deletedChatIds));
        await database.write(async () => {
          const messagesCollection = database.collections.get('messages');
          const messages = await messagesCollection
            .query(Q.where('chat_id', Q.oneOf(uniqueDeletedChatIds)))
            .fetch();
          if (messages.length === 0) return;
          const batch = messages.map((message: any) =>
            message.prepareDestroyPermanently()
          );
          await database.batch(...batch);
        });
        logger.log('🗑️ Removed orphan messages after chat deletions', {
          count: uniqueDeletedChatIds.length,
        });
      }

      logger.log('✅ Database synchronization completed');
    } catch (error) {
      logger.error('❌ Database synchronization failed:', error);
      throw error;
    } finally {
      syncingPromise = null;
    }
  })();

  return syncingPromise;
}
