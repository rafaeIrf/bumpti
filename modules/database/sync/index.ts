import { logger } from '@/utils/logger';
import { Database, Q } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { pullChanges } from './pullChanges';
import { pushChanges } from './pushChanges';
import { getSyncTimestamps, updateSyncTimestamps } from './types';

let syncingPromise: Promise<void> | null = null;

async function dedupeExistingMessages(database: Database, changes: any) {
  try {
    const createdMessages = changes?.messages?.created;
    if (!createdMessages?.length) return changes;

    const ids = createdMessages.map((m: any) => m.id);
    const collection = database.collections.get('messages');
    const existing = await collection.query(Q.where('id', Q.oneOf(ids))).fetch();
    const existingIds = new Set(existing.map((m: any) => m.id));

    if (existingIds.size === 0) return changes;

    const filtered = createdMessages.filter((m: any) => !existingIds.has(m.id));
    changes.messages.created = filtered;
    if (existingIds.size > 0) {
      logger.warn('Deduped messages already present locally:', existingIds.size);
    }
    return changes;
  } catch (error) {
    logger.error('Failed to dedupe messages:', error);
    return changes;
  }
}

/**
 * Sincroniza o banco de dados local com o backend
 * Usa WatermelonDB sync engine
 */
export async function syncDatabase(database: Database): Promise<void> {
  if (syncingPromise) {
    logger.log('⏳ Sync already in progress, skipping new sync request');
    return syncingPromise;
  }

  syncingPromise = (async () => {
    try {
      logger.log('🔄 Starting database synchronization...');

      const { lastPulledAt } = await getSyncTimestamps();

      await synchronize({
        database,
        pullChanges: async ({ lastPulledAt: serverLastPulledAt }) => {
          const timestamp = lastPulledAt || serverLastPulledAt || null;
          const { changes, timestamp: newTimestamp } = await pullChanges(timestamp);

          // Evitar erro de criação duplicada (já recebida via broadcast ou existente)
          const dedupedChanges = await dedupeExistingMessages(database, changes);
          
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
