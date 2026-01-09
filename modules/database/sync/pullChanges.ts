import { supabase } from '@/modules/supabase/client';
import { logger } from '@/utils/logger';
import { SyncDatabaseChangeSet } from '@nozbe/watermelondb/sync';
import type { PullChangesResponse } from './types';

/**
 * Puxa mudanças incrementais do backend
 * Chama o endpoint unificado sync-chat-data
 */
export async function pullChanges(
  lastPulledAt: number | null
): Promise<PullChangesResponse> {
  try {
    logger.log('🔽 Pulling changes from backend...', { lastPulledAt });

    const { data, error } = await supabase.functions.invoke('sync-chat-data', {
      body: {
        last_pulled_at: lastPulledAt,
      },
    });

    if (error) {
      logger.error('Failed to pull changes:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data received from sync endpoint');
    }

    // Transform backend response to WatermelonDB format
    // The response structure is { changes: { matches: ..., chats: ..., messages: ... }, timestamp: ... }
    const changes: SyncDatabaseChangeSet = {
      matches: {
        created: data.changes?.matches?.created || [],
        updated: data.changes?.matches?.updated || [],
        deleted: data.changes?.matches?.deleted || [],
      },
      chats: {
        created: data.changes?.chats?.created || [],
        updated: data.changes?.chats?.updated || [],
        deleted: data.changes?.chats?.deleted || [],
      },
      messages: {
        created: data.changes?.messages?.created || [],
        updated: data.changes?.messages?.updated || [],
        deleted: data.changes?.messages?.deleted || [],
      },
    };


    logger.log('📊 Detailed changes:', {
      matches: { 
        created: changes.matches.created.length, 
        updated: changes.matches.updated.length, 
        deleted: changes.matches.deleted.length 
      },
      chats: { 
        created: changes.chats.created.length, 
        updated: changes.chats.updated.length, 
        deleted: changes.chats.deleted.length 
      },
      messages: { 
        created: changes.messages.created.length, 
        updated: changes.messages.updated.length, 
        deleted: changes.messages.deleted.length 
      },
    });

    logger.log('✅ Pulled changes:', {
      matches: Object.keys(changes.matches).reduce((acc, k) => acc + changes.matches[k].length, 0),
      chats: Object.keys(changes.chats).reduce((acc, k) => acc + changes.chats[k].length, 0),
      messages: Object.keys(changes.messages).reduce((acc, k) => acc + changes.messages[k].length, 0),
    });

    return {
      changes,
      timestamp: data.timestamp || Date.now(),
    };
  } catch (error) {
    logger.error('Pull changes failed:', error);
    throw error;
  }
}
