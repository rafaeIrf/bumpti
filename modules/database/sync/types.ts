import { logger } from '@/utils/logger';
import { SyncDatabaseChangeSet } from '@nozbe/watermelondb/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tipos para sincronização
 */
export interface SyncTimestamps {
  lastPulledAt: number | null;
  lastPushedAt: number | null;
}

export interface PullChangesResponse {
  changes: SyncDatabaseChangeSet;
  timestamp: number;
}

export interface PushChangesPayload {
  changes: SyncDatabaseChangeSet;
  lastPulledAt: number;
}

export interface PushChangesResponse {
  success: boolean;
  timestamp: number;
}

/**
 * Armazena os últimos timestamps de sincronização
 */
let syncTimestamps: SyncTimestamps = {
  lastPulledAt: null,
  lastPushedAt: null,
};

const STORAGE_KEY = 'sync:timestamps';
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      syncTimestamps = {
        lastPulledAt: parsed.lastPulledAt ?? null,
        lastPushedAt: parsed.lastPushedAt ?? null,
      };
    }
  } catch (error) {
    logger.error('Failed to load sync timestamps from storage:', error);
  } finally {
    loaded = true;
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(syncTimestamps));
  } catch (error) {
    logger.error('Failed to persist sync timestamps:', error);
  }
}

export async function getSyncTimestamps(): Promise<SyncTimestamps> {
  await ensureLoaded();
  return { ...syncTimestamps };
}

export async function updateSyncTimestamps(updates: Partial<SyncTimestamps>): Promise<void> {
  await ensureLoaded();
  syncTimestamps = { ...syncTimestamps, ...updates };
  await persist();
  logger.log('Sync timestamps updated:', syncTimestamps);
}

export async function resetSyncTimestamps(): Promise<void> {
  syncTimestamps = {
    lastPulledAt: null,
    lastPushedAt: null,
  };
  await persist();
  logger.log('Sync timestamps reset');
}
