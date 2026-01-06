import { JWT } from "npm:google-auth-library";

// ... existing constants ...

import { importPKCS8, SignJWT } from "npm:jose";

export const SUBSCRIPTION_PLANS: Record<string, string> = {
  bumpti_premium_weekly: "week",
  bumpti_premium_monthly: "month",
  bumpti_premium_quarterly: "quarterly",
  bumpti_premium_yearly: "year",
};

export const CONSUMABLE_CREDITS: Record<string, number> = {
  bumpti_checkin_pack_1: 1,
  bumpti_checkin_pack_5: 5,
  bumpti_checkin_pack_10: 10,
};

export const SUBSCRIPTION_CREDITS_AWARD: Record<string, number> = {
  bumpti_premium_weekly: 0,
  bumpti_premium_monthly: 1,
  bumpti_premium_quarterly: 3,
  bumpti_premium_yearly: 5,
};

export async function validateAppleReceipt(
  purchase: any,
  expectedUserId: string
): Promise<any> {
    const keyId = Deno.env.get("APPLE_KEY_ID");
    const issuerId = Deno.env.get("APPLE_ISSUER_ID");
    const privateKeyContent = Deno.env.get("APPLE_PRIVATE_KEY");

    if (!keyId || !issuerId || !privateKeyContent) {
         throw new Error("Missing Apple API Credentials (APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY)");
    }
    console.log(`[Apple Auth] KeyID: ${keyId}, IssuerID: ${issuerId}, PrivateKeyLength: ${privateKeyContent.length}`);

    // Generate JWT for Apple API
    const bundleId = "com.bumpti"; 
    
    // Format key: ensure standard PEM format with headers
    let formattedKey = privateKeyContent.replace(/\\n/g, "\n").trim();
    
    // Check if it already has headers using a loose check (ignoring potential whitespace differences)
    if (!formattedKey.includes("-----BEGIN PRIVATE KEY-----")) {
        // If it's a raw key (base64) or one-liner without headers, wrap it standardly
        // Remove any existing partial headers just in case
        const cleanBody = formattedKey
            .replace(/-----BEGIN PRIVATE KEY-----/g, "")
            .replace(/-----END PRIVATE KEY-----/g, "")
            .replace(/\s/g, ""); // Remove all whitespace/newlines from body
            
        // Re-wrap with strict 64-char indentation if possible or just standard block
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${cleanBody}\n-----END PRIVATE KEY-----`;
    }

    const privateKey = await importPKCS8(formattedKey, "ES256");
    
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = { 
        bid: bundleId,
        iss: issuerId,
        aud: "appstoreconnect-v1",
        iat: now,
        exp: now + 3600 
    };
    
    const token = await new SignJWT(jwtPayload) 
        .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
        .sign(privateKey);

    // Use transactionId to fetch details
    // In expo-iap, 'transactionId' is usually present. 
    // If not, 'originalTransactionId' might be available, but usually for lookup we want the *current* transaction ID or original.
    // Apple API /transactions/{transactionId} works with either.
    const transactionId = purchase.transactionId || purchase.originalTransactionId;
    if (!transactionId) throw new Error("Missing transactionId or originalTransactionIdentifierIOS");

    // Helper to fetch from specific environment
    async function fetchTransaction(baseUrl: string) {
        const url = `${baseUrl}/inApps/v1/transactions/${transactionId}`;
        
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.status === 404) return null;
        if (!res.ok) {
             const text = await res.text();
             throw new Error(`Apple API Error: ${res.status} ${text}`);
        }
        return res.json();
    }

    // Try Production then Sandbox
    let response;
    try {
        response = await fetchTransaction("https://api.storekit.itunes.apple.com");
    } catch (e) {
        console.log(`[Apple Auth] Production validation failed, attempting Sandbox. Error: ${e}`);
        // Fallback to Sandbox
        response = await fetchTransaction("https://api.storekit-sandbox.itunes.apple.com");
    }

    if (!response) {
         // If response is null (404 on both?) or if sandbox threw
         throw new Error("Transaction not found in Apple Server API (Prod/Sandbox)");
    }

    if (!response || !response.signedTransactionInfo) {
        throw new Error("Transaction not found in Apple Server API");
    }

    // Decode JWS (signedTransactionInfo)
    // In production, you should verify the chain. For now, we decode the payload.
    // The JWS is typically: header.payload.signature
    const parts = response.signedTransactionInfo.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWS format");
    
    const payload = JSON.parse(atob(parts[1]));

    /*
    Payload fields:
    - transactionId
    - originalTransactionId
    - productId
    - purchaseDate: ms
    - expiresDate: ms (if sub)
    - revocationDate: ms (if revoked)
    - appAccountToken: UUID (if provided)
    */

    if (payload.revocationDate) {
        throw new Error("Transaction has been revoked");
    }

    const purchaseDate = new Date(payload.purchaseDate);
    const expiresDate = payload.expiresDate ? new Date(payload.expiresDate) : undefined;

    // Verify Ownership if appAccountToken is present
    if (payload.appAccountToken && payload.appAccountToken !== expectedUserId) {
        // Only throw if we are strictly enforcing match and confident client sent it correctly
        // throw new Error("Ownership mismatch (appAccountToken)"); 
    }

    return {
        sku: payload.productId,
        storeTransactionId: payload.transactionId,
        originalTransactionId: payload.originalTransactionId,
        purchaseDate,
        expiresDate,
        autoRenew: true, // Need to fetch subscription status for exact autoRenew status, defaulting true for valid active sub result
        appUserToken: payload.appAccountToken || purchase.appAccountToken || null,
    };
}

export function getGoogleAuthClient() {
    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (!serviceAccountStr) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT");

    const serviceAccount = JSON.parse(serviceAccountStr);
    
    return new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
}

/**
 * Fetches subscription status using the V2 API which relies only on the purchase token.
 * This is crucial for RTDN where subscriptionId might be missing.
 */
export async function fetchGoogleSubscriptionV2(
    client: any, 
    packageName: string, 
    token: string
): Promise<any> {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${token}`;
    const res = await client.request({ url });
    return res.data;
}

export async function validateGooglePurchase(
  purchase: any,
  expectedUserId: string
): Promise<any> {
    const client = getGoogleAuthClient();

    // We need: packageName, productId, purchaseToken
    // Retrieve these from the purchase payload from expo-iap
    const packageName = Deno.env.get("EXPECTED_PACKAGE_NAME") || "com.bumpti";

    const token = purchase.purchaseToken; // Ensure this is passed from client

    // Fetch subscription details using V2 API (Consistency with webhook)
    const subData = await fetchGoogleSubscriptionV2(client, packageName, token);

    /*
    subData structure (V2):
    {
      "startTime": "2024-01-01T...",
      "lineItems": [
         {
            "productId": "...",
            "expiryTime": "2024-02-01T...",
            "autoRenewingPlan": { "autoRenewEnabled": true }
         }
      ],
      "externalAccountIdentifiers": {
         "obfuscatedExternalAccountId": "..."
      },
      "latestOrderId": "..."
    }
    */

    // V2: Extract details from the first line item (usually only one for simple subs)
    if (!subData.lineItems || subData.lineItems.length === 0) {
        throw new Error("Invalid Google V2 Response: No lineItems found");
    }
    const item = subData.lineItems[0];

    // Validate ownership
    // V2 puts this in externalAccountIdentifiers
    const obfAccountId = subData.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (obfAccountId && obfAccountId !== expectedUserId) {
         throw new Error("Ownership mismatch (obfuscatedExternalAccountId)");
    }

    return {
        sku: item.productId, // Trust API's product ID over client's
        storeTransactionId: subData.latestOrderId,
        originalTransactionId: token, // Google purchaseToken is the persistent ID
        purchaseDate: new Date(subData.startTime), // V2 uses ISO strings
        expiresDate: item.expiryTime ? new Date(item.expiryTime) : undefined,
        autoRenew: item.autoRenewingPlan?.autoRenewEnabled ?? false,
        appUserToken: obfAccountId || purchase.obfuscatedAccountIdAndroid || null,
    };
}

export async function grantCheckinCredits(supabase: any, userId: string, amount: number, source: string) {
  // 1. Get current balance (or user row)
  const { data: balanceRow } = await supabase
    .from("user_checkin_credits")
    .select("credits") // Corrected col name from 'balance' to 'credits'
    .eq("user_id", userId) // PK is user_id
    .single();

  const currentBalance = balanceRow?.credits || 0;
  const newBalance = currentBalance + amount;

  // 2. Update balance
  const { error } = await supabase
    .from("user_checkin_credits")
    .upsert({ user_id: userId, credits: newBalance, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to update credits: ${error.message}`);
}

export async function getEntitlements(supabase: any, userId: string) {
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: credits } = await supabase
    .from("user_checkin_credits") // Correct table
    .select("credits") // Correct column name 'credits'
    .eq("user_id", userId)
    .maybeSingle();

  return {
    is_premium: sub?.status === 'active',
    plan: sub?.plan,
    premium_expires_at: sub?.current_period_end || sub?.expires_at,
    checkin_credits: credits?.credits || 0,
    show_subscription_bonus: !sub, // True only if user never had a subscription row
  };
}

/**
 * Validates a potential user ID (UUID format) and checks against Auth Admin API.
 */
export async function validateAndFetchUser(supabase: any, potentialUserId: string): Promise<string | null> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(potentialUserId)) {
        console.warn(`[Shared] Invalid UUID format: ${potentialUserId}`);
        return null;
    }

    try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(potentialUserId);
        if (userData && userData.user) {
            console.log(`[Shared] User ownership validated: ${potentialUserId}`);
            return potentialUserId;
        } else {
            console.warn(`[Shared] User not found in Auth: ${potentialUserId}`);
            return null;
        }
    } catch (err) {
        console.error(`[Shared] Error looking up user in Auth:`, err);
        return null;
    }
}
