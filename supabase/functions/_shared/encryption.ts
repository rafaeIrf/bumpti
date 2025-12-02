/**
 * Encryption utilities for end-to-end message encryption using AES-256-GCM
 */

/**
 * Fetches the encryption key from Supabase secrets (environment variables)
 */
export async function getEncryptionKey(): Promise<CryptoKey | null> {
  try {
    const keyBase64 = Deno.env.get("MESSAGE_ENCRYPTION_KEY");

    if (!keyBase64) {
      console.error("MESSAGE_ENCRYPTION_KEY not found in environment");
      return null;
    }

    // Decode base64 to Uint8Array (32 bytes for AES-256)
    const keyBytes = base64ToUint8Array(keyBase64);

    if (keyBytes.length !== 32) {
      console.error("Invalid key length. Expected 32 bytes for AES-256");
      return null;
    }

    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    return cryptoKey;
  } catch (err) {
    console.error("Error getting encryption key:", err);
    return null;
  }
}

/**
 * Encrypts a message using AES-256-GCM
 * Returns: { ciphertext_base64, iv_base64, tag_base64 }
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string; tag: string } | null> {
  try {
    // Generate random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encode plaintext to Uint8Array
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    // Encrypt using AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      plaintextBytes
    );

    // AES-GCM returns ciphertext + tag concatenated
    // Last 16 bytes are the tag
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const tag = encryptedArray.slice(-16);

    return {
      ciphertext: uint8ArrayToBase64(ciphertext),
      iv: uint8ArrayToBase64(iv),
      tag: uint8ArrayToBase64(tag),
    };
  } catch (err) {
    console.error("Encryption failed:", err);
    return null;
  }
}

/**
 * Decrypts a message using AES-256-GCM
 * Returns the plaintext string or null if decryption fails
 */
export async function decryptMessage(
  ciphertext_base64: string,
  iv_base64: string,
  tag_base64: string,
  key: CryptoKey
): Promise<string | null> {
  try {
    const ciphertext = base64ToUint8Array(ciphertext_base64);
    const iv = base64ToUint8Array(iv_base64);
    const tag = base64ToUint8Array(tag_base64);

    // AES-GCM expects ciphertext + tag concatenated
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128,
      },
      key,
      combined
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}

/**
 * Converts base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
