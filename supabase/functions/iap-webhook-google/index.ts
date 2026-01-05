import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { fetchGoogleSubscriptionV2, getGoogleAuthClient, validateAndFetchUser } from "../_shared/iap-validation.ts";

// --- Types ---
interface PubSubMessage {
  message: {
    data: string; // Base64 encoded JSON
    messageId: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface DeveloperNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId?: string; // Optional per request
  };
  oneTimeProductNotification?: {
    sku: string;
    notificationType: number;
    purchaseToken: string;
  };
  testNotification?: {
    version: string;
  };
  // other fields like voidedPurchaseNotification ignored for now
}

// --- Config ---
const WEBHOOK_SECRET = Deno.env.get("GOOGLE_PUBSUB_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPECTED_PACKAGE_NAME = Deno.env.get("EXPECTED_PACKAGE_NAME") || "com.bumpti";

// --- Helpers ---


// --- Main Handler ---
serve(async (req) => {
  // 1. Security Check
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  
  // Validate against query param 'secret'
  const url = new URL(req.url);
  const secretParam = url.searchParams.get("secret");

  if (WEBHOOK_SECRET && secretParam !== WEBHOOK_SECRET) {
      console.error("[Webhook] Invalid Secret");
      return new Response("Unauthorized", { status: 401 });
  }

  try {
    const rawBody = await req.text();
    let bodyJson: PubSubMessage;
    try {
        bodyJson = JSON.parse(rawBody);
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    if (!bodyJson.message || !bodyJson.message.data) {
        console.error("[Webhook] Invalid PubSub format");
        return new Response("Bad Request: Missing message.data", { status: 400 });
    }

    // 2. Decode Notification
    const decodedStr = atob(bodyJson.message.data);
    const notification: DeveloperNotification = JSON.parse(decodedStr);
    
    console.log(`[Webhook] Received MsgID: ${bodyJson.message.messageId}, Type: ${Object.keys(notification).find(k => k.endsWith("Notification"))}`);

    // Validate Package
    if (notification.packageName && notification.packageName !== EXPECTED_PACKAGE_NAME) {
         console.error(`[Webhook] Package name mismatch: ${notification.packageName}`);
         // Returning 200 to acknowledge and stop redelivery of irrelevant msg
         return new Response("OK", { status: 200 }); 
    }

    // 3. Idempotency Init
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Record Event (Idempotent)
    const storeEventId = bodyJson.message.messageId;
    
    // We try to find the user_id if purchaseToken is available
    let userId: string | null = null;
    let subState = null; // Store API response if we fetch it early
    const subNotif = notification.subscriptionNotification;
    
    if (subNotif) {
        const token = subNotif.purchaseToken;
        const { data: sub } = await supabase
            .from("user_subscriptions")
            .select("user_id")
            .eq("original_transaction_id", token) // For Google, we stored purchaseToken as original_transaction_id in 'validate'
            .eq("store", "google")
            .maybeSingle();

        if (sub) {
            userId = sub.user_id;
        } else {
             // Fallback: If not in DB, try to fetch from Google API to get obfuscatedExternalAccountId
             try {
                console.log("[Webhook] UserId not found in DB. Fetching from Google API...");
                const client = getGoogleAuthClient();
                subState = await fetchGoogleSubscriptionV2(client, notification.packageName, token);
                
                // Check externalAccountIdentifiers
                const obfId = subState.externalAccountIdentifiers?.obfuscatedExternalAccountId;
                if (obfId) {
                    // Use shared helper
                    userId = await validateAndFetchUser(supabase, obfId);
                    if (userId) {
                        console.log(`[Webhook] Recovered UserId from Google API: ${userId}`);
                    }
                }
             } catch (err) {
                 console.error("[Webhook] Failed to fetch user from Google API fallback:", err);
             }
        }
    }

    console.log(`[Webhook] Final Mapped UserID: ${userId || "NULL (Anonymous/Unknown)"}`);


    const NOTIFICATION_TYPE_MAP: Record<number, string> = {
        1: "SUBSCRIPTION_RECOVERED",
        2: "SUBSCRIPTION_RENEWED",
        3: "SUBSCRIPTION_CANCELED",
        4: "SUBSCRIPTION_PURCHASED",
        5: "SUBSCRIPTION_ON_HOLD",
        6: "SUBSCRIPTION_IN_GRACE_PERIOD",
        7: "SUBSCRIPTION_RESTARTED",
        8: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED",
        9: "SUBSCRIPTION_DEFERRED",
        10: "SUBSCRIPTION_PAUSED",
        11: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
        12: "SUBSCRIPTION_REVOKED",
        13: "SUBSCRIPTION_EXPIRED",
        17: "SUBSCRIPTION_ITEMS_CHANGED",
        18: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
        19: "SUBSCRIPTION_PRICE_CHANGE_UPDATED",
        20: "SUBSCRIPTION_PENDING_PURCHASE_CANCELED",
        22: "SUBSCRIPTION_PRICE_STEP_UP_CONSENT_UPDATED"
    };

    // Insert Event
    const eventTypeInt = subNotif?.notificationType;
    const eventTypeStr = eventTypeInt ? (NOTIFICATION_TYPE_MAP[eventTypeInt] || `SUBSCRIPTION:${eventTypeInt}`) : "OTHER";

    const { error: insertError } = await supabase
        .from("subscription_events")
        .insert({
           user_id: userId,
           store: "google",
           event_type: eventTypeStr,
           store_event_id: storeEventId,
           payload: bodyJson, 
           occurred_at: new Date(parseInt(notification.eventTimeMillis)).toISOString()
        });

    if (insertError) {
        if (insertError.code === "23505") { // Unique violation
            console.log(`[Webhook] Event ${storeEventId} already processed.`);
            return new Response("OK", { status: 200 });
        }
        console.error("[Webhook] Failed to insert event:", insertError);
        return new Response("OK", { status: 200 });
    }

    // 5. Process Subscription Status
    if (subNotif && userId) {
        const token = subNotif.purchaseToken;
        try {
            // Use existing subState if fetched during fallback, otherwise fetch now
            if (!subState) {
                const client = getGoogleAuthClient();
                subState = await fetchGoogleSubscriptionV2(client, notification.packageName, token);
            }
            
            /* v2 response structure typically:
               {
                 "kind": "androidpublisher#subscriptionPurchaseV2",
                 "startTime": "...",
                 "lineItems": [ { "productId": "...", "expiryTime": "...", "autoRenewingPlan": { "autoRenewEnabled": true } } ],
                 "subscriptionState": "SUBSCRIPTION_STATE_ACTIVE" 
               }
            */
            
            // We need to extract the *latest* expiry and autoRenew status.
            // Assuming single lineItem for simple subs.
            if (subState.lineItems && subState.lineItems.length > 0) {
                const item = subState.lineItems[0];
                const expiryStr = item.expiryTime; // ISO timestamp or similar? Protocol Buffers typically return proper strings?
                // Actually V2 often returns ISO strings in JSON. V1 returns millis as strings.
                // Let's verify format. The library returns JSON based on discovery doc.
                // Usually "expiryTime": "2024-01-01T00:00:00Z"
                
                const expiresDate = new Date(expiryStr);
                const autoRenew = item.autoRenewingPlan?.autoRenewEnabled ?? false;
                
                // Determine status based on dates + state
                const now = new Date();
                let status = "expired";
                if (expiresDate > now) {
                    status = "active";
                }
                
                // If subState literally says CANCELED, handle intent?
                if (subState.subscriptionState === "SUBSCRIPTION_STATE_CANCELED") {
                    // Logic: User canceled, but paid until expiry.
                    // Keep active if time remains.
                    // autoRenew is likely false.
                    // Status falls back to correct `active` via date check above.
                }

                if (expiresDate) {
                     await supabase
                        .from("user_subscriptions")
                        .update({
                            status,
                            auto_renew: autoRenew,
                            expires_at: expiresDate.toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq("user_id", userId)
                        .eq("store", "google");
                     
                     console.log(`[Webhook] Updated user ${userId}: ${status}, renew=${autoRenew}`);
                }
            }

        } catch (apiErr) {
            console.error("[Webhook] Failed to fetch Google API:", apiErr);
            // Don't fail the webhook, we logged the event.
        }
    } else if (notification.testNotification) {
         console.log("[Webhook] Test notification received.");
    }

    return new Response("OK", { status: 200 });

  } catch (err: any) {
    console.error("[Webhook] Unexpected Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
