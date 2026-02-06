/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// Shared modules
import { logModerationResult } from "../_shared/moderate/logging.ts";
import { moderateSingleImage } from "../_shared/moderate/moderator.ts";
import { callModerationAPI, callVisionAPI } from "../_shared/moderate/openai-client.ts";
import { containsPersonalData } from "../_shared/moderate/personal-data.ts";
import { checkContentThresholds } from "../_shared/moderate/thresholds.ts";
import type {
  BatchModerationRequest,
  BatchModerationResponse,
  ModerationRequest,
  SingleModerationRequest,
  SingleModerationResponse,
} from "../_shared/moderate/types.ts";

// Environment
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

// CORS configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================================
// Utility Functions
// ============================================================================

function createJsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * Handles single content moderation (text or image)
 */
async function handleSingleModeration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  type: "text" | "image",
  content: string
): Promise<Response> {
  // Check for personal data in text content first (before calling OpenAI)
  if (type === "text" && containsPersonalData(content)) {
    await logModerationResult(supabase, userId, type, "rejected", "personal_data_detected", null);
    return createJsonResponse<SingleModerationResponse>({ 
      approved: false, 
      reason: "personal_data_detected" 
    });
  }

  // For images, use the shared moderation logic (safety + human/pet detection)
  if (type === "image") {
    const result = await moderateSingleImage(openaiApiKey, content);
    
    await logModerationResult(
      supabase,
      userId,
      type,
      result.approved ? "approved" : "rejected",
      result.reason,
      result.scores
    );

    return createJsonResponse<SingleModerationResponse>({ 
      approved: result.approved, 
      reason: result.reason 
    });
  }

  // For text, use safety check only
  const moderationResult = await callModerationAPI(openaiApiKey, type, content);

  if (!moderationResult.success) {
    console.error("[MODERATION] Text safety check failed, rejecting:", moderationResult.error);
    await logModerationResult(supabase, userId, type, "rejected", "content_flagged", null);
    return createJsonResponse<SingleModerationResponse>({ 
      approved: false, 
      reason: "content_flagged" 
    });
  }

  const { flagged, category_scores } = moderationResult.results![0];

  let approved = true;
  let reason: SingleModerationResponse["reason"] = null;

  if (flagged) {
    approved = false;
    reason = "content_flagged";
  } else {
    const thresholdReason = checkContentThresholds(category_scores, type);
    if (thresholdReason) {
      approved = false;
      reason = thresholdReason as SingleModerationResponse["reason"];
    }
  }

  await logModerationResult(
    supabase,
    userId,
    type,
    approved ? "approved" : "rejected",
    reason,
    category_scores
  );

  return createJsonResponse<SingleModerationResponse>({ approved, reason });
}

/**
 * Handles batch image moderation with optimized API calls
 * 
 * OPTIMIZED Flow:
 * 1. Parallel Moderation API calls for safety (OpenAI limit: 1 image per request)
 * 2. Collect images that passed safety
 * 3. ONE Vision API call for human/pet detection on all passed images
 * 
 * Cost: N safety calls (parallel) + 1 Vision call
 */
async function handleBatchModeration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  images: string[]
): Promise<Response> {
  const imageCount = images.length;
  
  console.log(`[BILLING] Batch moderation started: ${imageCount} photos`);

  // Step 1: Parallel Moderation API calls (OpenAI doesn't support batch for moderation)
  const safetyResults = await Promise.all(
    images.map(async (base64, index) => {
      const result = await callModerationAPI(openaiApiKey, "image", base64);
      
      if (!result.success || !result.results) {
        console.warn(`[SAFETY] Image ${index}: API error, rejecting`);
        return { approved: false, reason: "content_flagged" as const, scores: null };
      }

      const { flagged, category_scores } = result.results[0];
      
      if (flagged) {
        console.log(`[SAFETY] Image ${index}: Flagged by OpenAI`);
        return { approved: false, reason: "content_flagged" as const, scores: category_scores };
      }

      const thresholdReason = checkContentThresholds(category_scores, "image");
      if (thresholdReason) {
        console.log(`[SAFETY] Image ${index}: Failed threshold - ${thresholdReason}`);
        return { approved: false, reason: "sensitive_content" as const, scores: category_scores };
      }

      return { approved: true, reason: null, scores: category_scores };
    })
  );

  console.log(`[BILLING] Batch safety check: ${imageCount} photos in ${imageCount} parallel API calls`);

  // Step 2: Collect images that passed safety
  const safeImages: string[] = [];
  
  safetyResults.forEach((result, index) => {
    if (result.approved) {
      safeImages.push(images[index]);
    }
  });

  console.log(`[BATCH] Safety check complete: ${safeImages.length}/${imageCount} passed`);

  // Step 3: ONE Vision API call for human/pet detection on all safe images
  let humanResults: boolean[] = [];
  
  if (safeImages.length > 0) {
    const humanDetection = await callVisionAPI(openaiApiKey, safeImages);
    
    if (humanDetection.success && humanDetection.results) {
      humanResults = humanDetection.results;
      console.log(`[BILLING] Vision Batch complete: ${safeImages.length} photos in ONE call.`);
    } else {
      // Fail-safe: approve all on detection error
      console.warn("[BATCH] Vision detection failed, approving all safe images");
      humanResults = safeImages.map(() => true);
    }
  }

  // Step 4: Build final results array and log each image individually
  const finalResults: BatchModerationResponse["results"] = [];
  let humanResultIndex = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (let i = 0; i < imageCount; i++) {
    const safetyResult = safetyResults[i];
    const aiScores = safetyResult.scores;  // scores included in parallel results
    
    if (!safetyResult.approved) {
      // Image failed safety check
      finalResults.push({ approved: false, reason: safetyResult.reason });
      rejectedCount++;
      
      // Log individual rejection
      await logModerationResult(
        supabase,
        userId,
        "image",
        "rejected",
        safetyResult.reason,
        aiScores
      );
    } else {
      // Image passed safety, check human/pet detection
      const isHumanOrAnimal = humanResults[humanResultIndex++];
      
      if (isHumanOrAnimal) {
        finalResults.push({ approved: true, reason: null });
        approvedCount++;
        
        // Log individual approval
        await logModerationResult(
          supabase,
          userId,
          "image",
          "approved",
          null,
          aiScores
        );
      } else {
        finalResults.push({ approved: false, reason: "not_human" });
        rejectedCount++;
        
        // Log individual rejection (not human/pet)
        await logModerationResult(
          supabase,
          userId,
          "image",
          "rejected",
          "not_human",
          aiScores
        );
      }
    }
  }

  console.log(`[BILLING] Batch complete: ${approvedCount} approved, ${rejectedCount} rejected`);

  return createJsonResponse<BatchModerationResponse>({
    results: finalResults,
    processedCount: imageCount,
  });
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Validate auth
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return createJsonResponse({ error: "unauthorized", message: "Missing access token" }, 401);
  }

  if (!openaiApiKey) {
    console.error("Missing OPENAI_API_KEY");
    return createJsonResponse({ error: "server_error", message: "Moderation service unavailable" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Verify user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      return createJsonResponse({ error: "unauthorized", message: "Invalid or expired token" }, 401);
    }

    // Parse request body
    const body = await req.json() as ModerationRequest;

    // Handle batch images
    if (body.type === "batch-images") {
      const { images } = body as BatchModerationRequest;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        return createJsonResponse({ error: "bad_request", message: "Missing or empty images array" }, 400);
      }

      if (images.length > 9) {
        return createJsonResponse({ error: "bad_request", message: "Maximum 9 images allowed per batch" }, 400);
      }

      return handleBatchModeration(supabase, user.id, images);
    }

    // Handle single moderation (text or image)
    const { type, content } = body as SingleModerationRequest;

    if (!type || !content) {
      return createJsonResponse({ error: "bad_request", message: "Missing type or content" }, 400);
    }

    if (type !== "text" && type !== "image") {
      return createJsonResponse({ error: "bad_request", message: "Type must be 'text', 'image', or 'batch-images'" }, 400);
    }

    return handleSingleModeration(supabase, user.id, type, content);
  } catch (error) {
    console.error("moderate-content error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unable to moderate content";
    return createJsonResponse({ error: "server_error", message: errorMessage }, 500);
  }
});
