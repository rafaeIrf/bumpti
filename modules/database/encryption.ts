import { logger } from '@/utils/logger';
import * as Crypto from 'expo-crypto';
import * as Keychain from 'react-native-keychain';

const DB_KEY_SERVICE = 'watermelondb_encryption';
const DB_KEY_USERNAME = 'encryption_key';

/**
 * Gera uma chave AES-256 aleatória (32 bytes)
 */
async function generateEncryptionKey(): Promise<string> {
  // Gerar 32 bytes aleatórios usando expo-crypto
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  // Converter para hex string
  return Array.from(randomBytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Recupera ou cria a chave de criptografia do banco de dados
 * Armazenada de forma segura no iOS Keychain / Android Keystore
 */
export async function getDatabaseEncryptionKey(): Promise<string> {
  try {
    // Tentar recuperar chave existente
    const credentials = await Keychain.getGenericPassword({
      service: DB_KEY_SERVICE,
    });

    if (credentials) {
      logger.log('Database encryption key retrieved from Keychain');
      return credentials.password;
    }

    // Se não existir, criar nova chave
    logger.log('Generating new database encryption key');
    const newKey = await generateEncryptionKey();

    // Armazenar no Keychain
    await Keychain.setGenericPassword(DB_KEY_USERNAME, newKey, {
      service: DB_KEY_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    logger.log('Database encryption key stored in Keychain');
    return newKey;
  } catch (error) {
    logger.error('Failed to get/create encryption key:', error);
    throw new Error('Database encryption key unavailable');
  }
}

/**
 * Reseta a chave de criptografia (força recriação do banco)
 * Usar apenas em caso de chave perdida ou reset completo
 */
export async function resetDatabaseEncryptionKey(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: DB_KEY_SERVICE });
    logger.log('Database encryption key reset');
  } catch (error) {
    logger.error('Failed to reset encryption key:', error);
    throw error;
  }
}

/**
 * Verifica se chave de criptografia existe
 */
export async function hasEncryptionKey(): Promise<boolean> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: DB_KEY_SERVICE,
    });
    return !!credentials;
  } catch {
    return false;
  }
}
