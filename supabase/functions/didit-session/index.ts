/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

/**
 * Edge Function: didit-session
 * 
 * Purpose: Create a Didit Authentication Intent for identity verification.
 * - Requires authentication
 * - Calls Didit API to create verification session
 * - Updates profile verification_status to 'pending'
 * - Returns verification URL for user to complete in browser
 */

Deno.serve(async (req) => {
  console.log("[didit-session] Request started:", {
    method: req.method,
    url: req.url,
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.log("[didit-session] Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Authenticate user
    console.log("[didit-session] Authenticating user...");
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      console.log("[didit-session] Authentication failed");
      return authResult.response;
    }

    const { user } = authResult;
    const userId = user.id;
    console.log("[didit-session] User authenticated:", { userId });

    // Get environment variables for Didit API
    const diditApiKey = Deno.env.get("DIDIT_API_KEY");
    const diditApiUrl = Deno.env.get("DIDIT_API_URL") || "https://verification.didit.me";
    const workflowId = Deno.env.get("DIDIT_WORKFLOW_ID");
    const callbackUrl = Deno.env.get("DIDIT_WEBHOOK_URL"); // Optional callback URL

    console.log("[didit-session] Environment variables:", {
      hasApiKey: !!diditApiKey,
      apiUrl: diditApiUrl,
      hasWorkflowId: !!workflowId,
      hasCallbackUrl: !!callbackUrl,
    });

    if (!diditApiKey) {
      console.error("[didit-session] DIDIT_API_KEY not configured");
      throw new Error("DIDIT_API_KEY not configured");
    }

    if (!workflowId) {
      console.error("[didit-session] DIDIT_WORKFLOW_ID not configured");
      throw new Error("DIDIT_WORKFLOW_ID not configured");
    }

    // Check if user already has a verified status
    console.log("[didit-session] Fetching profile for user:", userId);
    const supabaseAdmin = createAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("verification_status")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("[didit-session] Failed to fetch profile:", {
        error: profileError,
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    console.log("[didit-session] Profile fetched:", {
      userId,
      verification_status: profile?.verification_status,
      hasProfile: !!profile,
    });

    if (profile.verification_status === "verified") {
      console.log("[didit-session] Profile already verified, returning 400");
      return new Response(
        JSON.stringify({
          error: "already_verified",
          message: "Profile is already verified",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Allow retry even if pending (user may have closed browser)
    // New session will replace the previous one
    if (profile.verification_status === "pending") {
      console.log("[didit-session] Creating new session to replace pending verification");
    }

    // Create verification session with Didit API v2
    // Reference: https://docs.didit.me/reference/quick-start
    const requestBody: Record<string, any> = {
      workflow_id: workflowId,
      vendor_data: userId, // Pass user_id as vendor_data (returned in webhook)
    };

    // Add optional callback URL if configured (for webhook notifications)
    if (callbackUrl) {
      requestBody.callback = callbackUrl;
    }

    // Note: We don't set a redirect_url to keep user in the verification flow
    // The webhook will handle the status update

    console.log("[didit-session] Calling Didit API:", {
      url: `${diditApiUrl}/v2/session/`,
      hasWorkflowId: !!requestBody.workflow_id,
      hasVendorData: !!requestBody.vendor_data,
      hasCallback: !!requestBody.callback,
    });

    const diditResponse = await fetch(`${diditApiUrl}/v2/session/`, {
      method: "POST",
      headers: {
        "x-api-key": diditApiKey,
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[didit-session] Didit API response status:", diditResponse.status);

    if (!diditResponse.ok) {
      const errorText = await diditResponse.text();
      console.error("[didit-session] Didit API error:", {
        status: diditResponse.status,
        statusText: diditResponse.statusText,
        error: errorText,
      });
      throw new Error(`Didit API request failed: ${diditResponse.status} - ${errorText}`);
    }

    const diditData = await diditResponse.json();
    console.log("[didit-session] Didit session created:", { 
      session_id: diditData.session_id,
      hasUrl: !!diditData.url,
      hasSessionUrl: !!diditData.session_url,
      hasVerificationUrl: !!diditData.verification_url,
    });

    // Extract verification URL from Didit response
    // Didit returns a URL in the response that the user should visit
    const verificationUrl = diditData.url || diditData.session_url || diditData.verification_url;

    if (!verificationUrl) {
      console.error("[didit-session] No verification URL in response:", {
        keys: Object.keys(diditData),
        data: diditData,
      });
      throw new Error("No verification URL returned from Didit API");
    }

    console.log("[didit-session] Verification URL found, updating profile status to pending");

    // Update profile status to 'pending'
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ verification_status: "pending" })
      .eq("id", userId);

    if (updateError) {
      console.error("[didit-session] Failed to update profile:", {
        error: updateError,
        userId,
      });
      throw new Error(`Failed to update verification status: ${updateError.message}`);
    }

    console.log("[didit-session] Profile updated to pending successfully");

    // Return verification URL and session info to client
    console.log("[didit-session] Success! Returning response to client");
    return new Response(
      JSON.stringify({
        success: true,
        verification_url: verificationUrl,
        session_id: diditData.session_id,
        status: "pending",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[didit-session] ERROR:", {
      message: error?.message,
      stack: error?.stack,
      error: error,
    });
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
