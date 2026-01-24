/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

/**
 * Edge Function: didit-webhook
 * 
 * Purpose: Receive verification results from Didit API v2.
 * - Public endpoint (no auth required, but signature validated)
 * - Validates X-Signature and X-Timestamp headers for security
 * - Updates verification_status in profiles table
 * - Broadcasts update via Realtime to notify the app
 * 
 * Reference: https://docs.didit.me/reference/webhooks
 */

// Types for Didit webhook payload (status.updated)
interface DiditWebhookPayload {
  session_id: string;
  status: string; // "Not Started" | "In Progress" | "In Review" | "Approved" | "Declined"
  webhook_type: "status.updated" | "data.updated";
  created_at: number; // Unix timestamp
  timestamp: number; // Unix timestamp
  workflow_id: string;
  vendor_data: string; // This is our user_id
  metadata?: {
    [key: string]: any;
  };
  decision?: {
    reason?: string;
    details?: string;
  };
}

/**
 * Verify Didit webhook signature using HMAC SHA-256
 * Reference: https://docs.didit.me/reference/webhooks
 * 
 * Didit sends:
 * - X-Signature: HMAC-SHA256 hex of raw body
 * - X-Timestamp: Unix timestamp (validate freshness)
 */
async function verifyDiditSignature(
  rawBody: string,
  providedSignature: string,
  timestamp: string,
  secret: string
): Promise<boolean> {
  try {
    // Validate timestamp (must be within 5 minutes to prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000);
    const incomingTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - incomingTime) > 300) {
      console.warn("Webhook timestamp is stale:", { currentTime, incomingTime });
      return false;
    }

    // Compute HMAC-SHA256 of raw body
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );

    // Convert signature to hex
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Timing-safe comparison
    return timingSafeEqual(expectedSignature, providedSignature);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  const requestMethod = req.method;
  const requestUrl = req.url;
  
  console.log("[didit-webhook] Incoming request:", {
    method: requestMethod,
    url: requestUrl,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight
  if (requestMethod === "OPTIONS") {
    console.log("[didit-webhook] CORS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle GET request - browser redirect from Didit after verification
  if (requestMethod === "GET") {
    const url = new URL(requestUrl);
    console.log("[didit-webhook] Browser redirect (GET):", {
      searchParams: Object.fromEntries(url.searchParams.entries())
    });

    // Return simple HTML page for WebView to detect
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verificação Concluída</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1>Verificação Concluída</h1>
          <p>Você pode fechar esta janela.</p>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }

  // Only POST requests beyond this point (actual webhooks)
  if (requestMethod !== "POST") {
    console.log("[didit-webhook] Method not allowed:", requestMethod);
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Get webhook secret from environment
    const webhookSecret = Deno.env.get("DIDIT_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("DIDIT_WEBHOOK_SECRET not configured");
    }

    // Check if this is a test webhook from Didit Dashboard
    const isTestWebhook = req.headers.get("X-Didit-Test-Webhook") === "true";

    // Get signature and timestamp from headers
    // Didit can send different signature headers: X-Signature, X-Signature-V2, or X-Signature-Simple
    const signature = req.headers.get("X-Signature") || 
                     req.headers.get("X-Signature-V2") || 
                     req.headers.get("X-Signature-Simple");
    const timestamp = req.headers.get("X-Timestamp");

    if (!signature || !timestamp) {
      console.warn("Missing signature or timestamp header");
      return new Response(
        JSON.stringify({ error: "missing_headers" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Skip signature validation for test webhooks
    if (!isTestWebhook) {
      // Verify signature and timestamp for production webhooks
      const isValid = await verifyDiditSignature(rawBody, signature, timestamp, webhookSecret);
      if (!isValid) {
        console.warn("Invalid webhook signature or stale timestamp");
        return new Response(
          JSON.stringify({ error: "invalid_signature" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      console.log("Test webhook detected, skipping signature validation");
    }

    // Parse payload after signature verification
    const payload: DiditWebhookPayload = JSON.parse(rawBody);

    console.log("Didit webhook received:", {
      webhook_type: payload.webhook_type,
      session_id: payload.session_id,
      status: payload.status,
      vendor_data: payload.vendor_data,
    });

    // Extract user_id from vendor_data (passed during session creation)
    const userId = payload.vendor_data;
    if (!userId) {
      console.warn("Missing vendor_data (user_id) in webhook payload");
      return new Response(
        JSON.stringify({ error: "missing_user_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate that userId is a valid UUID (not a test string from Didit Dashboard)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.warn("Invalid UUID in vendor_data (likely a test webhook):", userId);
      // Return success for test webhooks without updating database
      return new Response(
        JSON.stringify({
          success: true,
          message: "Test webhook received successfully",
          user_id: userId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only process status.updated webhooks
    if (payload.webhook_type !== "status.updated") {
      console.log(`Ignoring webhook type: ${payload.webhook_type}`);
      return new Response(
        JSON.stringify({ success: true, message: "Webhook type ignored" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine verification status based on Didit status
    let verificationStatus: "verified" | "rejected" | "pending" = "pending";

    if (payload.status === "Approved") {
      verificationStatus = "verified";
    } else if (payload.status === "Declined") {
      verificationStatus = "rejected";
    } else if (payload.status === "In Progress" || payload.status === "In Review") {
      verificationStatus = "pending";
    } else {
      // Status is "Not Started" or unknown - keep as pending
      console.log(`Keeping status as pending for Didit status: ${payload.status}`);
      verificationStatus = "pending";
    }

    // Update profile verification status
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ verification_status: verificationStatus })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update verification status:", updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(`Updated verification_status to '${verificationStatus}' for user ${userId}`);

    // Broadcast update via Realtime
    // Client will listen on channel `user:${userId}` for event 'verification_status_updated'
    const channelName = `user:${userId}`;
    const { error: broadcastError } = await supabase
      .channel(channelName)
      .send({
        type: "broadcast",
        event: "verification_status_updated",
        payload: {
          user_id: userId,
          verification_status: verificationStatus,
          updated_at: new Date().toISOString(),
        },
      });

    if (broadcastError) {
      console.error("Failed to broadcast verification update:", broadcastError);
      // Don't throw - update was successful, broadcast is secondary
    } else {
      console.log(`Broadcasted verification update to channel '${channelName}'`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        verification_status: verificationStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("didit-webhook error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
