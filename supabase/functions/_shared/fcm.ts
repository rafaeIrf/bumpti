import { create } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

/**
 * Interface for the Google Service Account JSON
 */
interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Helper to import the private key string as a CryptoKey
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove header/footer and newlines
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
    
  // Base64 decode
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["sign"]
  );
}

/**
 * generateFCMToken
 * Generates an OAuth2 access token for Firebase Cloud Messaging HTTP v1 API
 * using the Service Account stored in Supabase Secrets.
 */
export async function generateFCMToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const hour = 3600;

  // Manually manually import key to avoid djwt parsing issues
  const privateKey = await importPrivateKey(serviceAccount.private_key);

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + hour,
      iat: now,
    },
    privateKey
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  return data.access_token;
}

/**
 * FCM Payload Interface (HTTP v1)
 */
export interface FCMPayload {
  token: string;
  notification?: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: "high" | "normal";
    notification?: {
      sound?: string;
    }
  };
  apns?: {
    payload?: {
      aps?: {
        sound?: string;
        badge?: number;
      };
    };
  };
}

/**
 * sendFCMMessage
 * Sends a message to a specific device via FCM HTTP v1 API
 */
export async function sendFCMMessage(
  projectId: string,
  accessToken: string,
  payload: FCMPayload
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: payload }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // Parse error to check for invalid tokens
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // ignore
    }

    const errorCode = errorJson?.error?.details?.[0]?.errorCode || "UNKNOWN";
    
    // Return structured error for the caller to handle (e.g., deactivate token)
    return {
      success: false,
      errorCode,
      errorText,
    };
  }

  return { success: true };
}
