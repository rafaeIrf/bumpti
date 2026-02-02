import { logger } from "@/utils/logger";
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { getDatabaseEncryptionKey, resetDatabaseEncryptionKey } from "./encryption";
import migrations from "./migrations";
import { schema } from "./schema";
import { resetSyncTimestamps } from "./sync/types";

// Models
import Chat from "./models/Chat";
import DiscoveryProfile from "./models/DiscoveryProfile";
import LikerId from "./models/LikerId";
import Match from "./models/Match";
import Message from "./models/Message";
import Profile from "./models/Profile";
import SwipeQueue from "./models/SwipeQueue";

let database: Database | null = null;

/**
 * Inicializa o WatermelonDB com SQLCipher
 */
export async function initDatabase(): Promise<Database> {
  if (database) {
    return database;
  }

  try {
    // Recuperar chave de criptografia
    const encryptionKey = await getDatabaseEncryptionKey();
    const adapter = new SQLiteAdapter({
      schema,
      migrations,
      // WatermelonDB's JSI adapter works on both iOS and Android (v0.26+)
      jsi: true,
      onSetUpError: (error) => {
        logger.error('Database setup error:', error);
      },
      // Encryption key for SQLCipher support
      // @ts-ignore - encryptionKey is supported but not typed in all adapters
      encryptionKey,
    });

    database = new Database({
      adapter,
      modelClasses: [
        Match,
        Chat,
        Message,
        Profile,
        DiscoveryProfile,
        SwipeQueue,
        LikerId,
      ],
    });

    logger.log('WatermelonDB initialized with SQLCipher');
    return database;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Failed to initialize database:', error);
    } else {
      logger.error('Failed to initialize database:', String(error));
    }

    // Se falhou por problema de criptografia, tentar reset
    const message = error instanceof Error ? error.message : "";
    if (message.includes('cipher') || message.includes('decrypt')) {
      logger.warn('Encryption key mismatch detected, resetting database');
      
      try {
        await resetDatabaseEncryptionKey();
        // Recursivamente tentar inicializar novamente
        return initDatabase();
      } catch (resetError) {
        logger.error('Failed to reset and reinitialize database:', resetError);
        throw resetError;
      }
    }

    throw error;
  }
}

/**
 * Retorna a instância do banco de dados
 * Se não estiver inicializado, inicializa primeiro
 */
export async function getDatabase(): Promise<Database> {
  if (!database) {
    return initDatabase();
  }
  return database;
}

/**
 * Reseta o banco de dados completamente
 * Usar apenas em casos extremos (logout, erro irrecuperável)
 */
export async function resetDatabase(): Promise<void> {
  try {
    if (database) {
      await database.write(async () => {
        await database!.unsafeResetDatabase();
      });
      logger.log('Database reset completed');
    }

    await resetDatabaseEncryptionKey();
    await resetSyncTimestamps();
    database = null;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Failed to reset database:', error);
    } else {
      logger.error('Failed to reset database:', String(error));
    }
    throw error;
  }
}
