/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

// OpenAI API endpoints
const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

// Models
const OPENAI_MODERATION_MODEL = "omni-moderation-latest";
const OPENAI_VISION_MODEL = "gpt-4o-mini";

// Cost constants for billing logs
const TOKENS_PER_LOW_DETAIL_IMAGE = 85;

// Sensitivity thresholds for various categories (even if not flagged by OpenAI)
// Lower = more strict. These apply even when OpenAI doesn't flag the content.
// 
// TEXT thresholds are STRICTER because explicit terms in PT/ES get lower scores
// IMAGE thresholds are LESS STRICT to avoid false positives on normal photos

// Text moderation thresholds (stricter)
const TEXT_SEXUAL_THRESHOLD = 0.25;     // Catches explicit terms in PT/ES
const TEXT_VIOLENCE_THRESHOLD = 0.25;   // Violence references
const TEXT_HARASSMENT_THRESHOLD = 0.25; // Harassment, bullying
const TEXT_HATE_THRESHOLD = 0.25;       // Hate speech
const TEXT_SELF_HARM_THRESHOLD = 0.3;   // Self-harm references

// Image moderation thresholds (less strict to avoid false positives)
const IMAGE_SEXUAL_THRESHOLD = 0.45;     // Higher - visual content scores higher
const IMAGE_VIOLENCE_THRESHOLD = 0.35;   // Weapons, gore
const IMAGE_HARASSMENT_THRESHOLD = 0.4;  // Offensive imagery
const IMAGE_HATE_THRESHOLD = 0.4;        // Hate symbols
const IMAGE_SELF_HARM_THRESHOLD = 0.5;   // Apple compliance

// Regex patterns for personal data detection
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g;
const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9]+\.(com|net|org|io|me|br|co)[^\s]*/gi;

// ============================================================================
// Types
// ============================================================================

interface SingleModerationRequest {
  type: "text" | "image";
  content: string;
}

interface BatchModerationRequest {
  type: "batch-images";
  images: string[];
}

type ModerationRequest = SingleModerationRequest | BatchModerationRequest;

interface SingleModerationResponse {
  approved: boolean;
  reason: "content_flagged" | "sensitive_content" | "personal_data_detected" | "not_human" | null;
}

interface BatchModerationResponse {
  results: {
    approved: boolean;
    reason: "content_flagged" | "sensitive_content" | "not_human" | null;
  }[];
  processedCount: number;
}

interface OpenAIModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if text contains personal data (phone numbers or external links)
 */
function containsPersonalData(text: string): boolean {
  return PHONE_REGEX.test(text) || URL_REGEX.test(text);
}

/**
 * Checks if content scores exceed our sensitivity thresholds
 * Returns the reason if threshold is exceeded, null otherwise
 */
function checkContentThresholds(
  scores: Record<string, number>,
  contentType: "text" | "image"
): string | null {
  // Select thresholds based on content type
  const isText = contentType === "text";
  const sexualThreshold = isText ? TEXT_SEXUAL_THRESHOLD : IMAGE_SEXUAL_THRESHOLD;
  const violenceThreshold = isText ? TEXT_VIOLENCE_THRESHOLD : IMAGE_VIOLENCE_THRESHOLD;
  const harassmentThreshold = isText ? TEXT_HARASSMENT_THRESHOLD : IMAGE_HARASSMENT_THRESHOLD;
  const hateThreshold = isText ? TEXT_HATE_THRESHOLD : IMAGE_HATE_THRESHOLD;
  const selfHarmThreshold = isText ? TEXT_SELF_HARM_THRESHOLD : IMAGE_SELF_HARM_THRESHOLD;

  // Sexual content (including minors and suggestive - zero tolerance for minors)
  const sexualScore = scores["sexual"] ?? 0;
  const sexualMinorsScore = scores["sexual/minors"] ?? 0;
  const sexualSuggestiveScore = scores["sexual/suggestive"] ?? 0;
  if (
    sexualScore > sexualThreshold || 
    sexualMinorsScore > sexualThreshold ||
    sexualSuggestiveScore > sexualThreshold
  ) {
    return "sensitive_content";
  }

  // Violence (weapons, gore, graphic content)
  const violenceScore = scores["violence"] ?? 0;
  const violenceGraphicScore = scores["violence/graphic"] ?? 0;
  if (violenceScore > violenceThreshold || violenceGraphicScore > violenceThreshold) {
    return "sensitive_content";
  }

  // Harassment and hate speech
  const harassmentScore = scores["harassment"] ?? 0;
  const harassmentThreateningScore = scores["harassment/threatening"] ?? 0;
  const hateScore = scores["hate"] ?? 0;
  const hateThreateningScore = scores["hate/threatening"] ?? 0;
  
  if (
    harassmentScore > harassmentThreshold ||
    harassmentThreateningScore > harassmentThreshold ||
    hateScore > hateThreshold ||
    hateThreateningScore > hateThreshold
  ) {
    return "sensitive_content";
  }

  // Self-harm (Apple compliance requirement)
  const selfHarmScore = scores["self-harm"] ?? 0;
  const selfHarmIntentScore = scores["self-harm/intent"] ?? 0;
  const selfHarmInstructionsScore = scores["self-harm/instructions"] ?? 0;
  
  if (
    selfHarmScore > selfHarmThreshold ||
    selfHarmIntentScore > selfHarmThreshold ||
    selfHarmInstructionsScore > selfHarmThreshold
  ) {
    return "sensitive_content";
  }

  return null;
}

/**
 * Logs moderation result to database for audit
 * Does not store raw content (base64/text) for privacy and disk savings
 */
async function logModerationResult(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  contentType: "text" | "image" | "batch-images",
  status: "approved" | "rejected" | "passed_by_error",
  rejectionReason: string | null,
  aiScores: Record<string, number> | null,
  imageCount?: number
): Promise<void> {
  await supabase.from("content_moderation_logs").insert({
    user_id: userId,
    content_type: contentType,
    status,
    rejection_reason: rejectionReason,
    ai_scores: aiScores,
    image_count: imageCount,
  });
}

// ============================================================================
// OpenAI API Functions
// ============================================================================

/**
 * Calls OpenAI Moderation API (for text and single image safety check)
 */
async function callOpenAIModeration(
  type: "text" | "image",
  content: string
): Promise<{ success: boolean; result?: OpenAIModerationResult; error?: string }> {
  try {
    let input: unknown;

    if (type === "image") {
      // Format for image moderation
      input = [
        {
          type: "image_url",
          image_url: {
            url: content.startsWith("data:") ? content : `data:image/jpeg;base64,${content}`,
          },
        },
      ];
    } else {
      // Text moderation
      input = content;
    }

    const response = await fetch(OPENAI_MODERATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODERATION_MODEL,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return { success: false, error: `OpenAI API error: ${response.status}` };
    }

    const data = await response.json();
    const result = data.results?.[0] as OpenAIModerationResult;

    if (!result) {
      return { success: false, error: "No moderation result returned" };
    }

    return { success: true, result };
  } catch (error) {
    console.error("OpenAI moderation call failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Calls OpenAI Chat Completions API with vision for batch human/pet detection
 * Uses gpt-4o-mini with detail: "low" for cost optimization
 */
async function callBatchHumanDetection(
  images: string[]
): Promise<{ success: boolean; results?: boolean[]; error?: string }> {
  try {
    // Build content array with all images
    const content: { type: string; text?: string; image_url?: { url: string; detail: string } }[] = [
      { 
        type: "text", 
        text: "Check each photo: real photo of Human or real Animal (true) vs Landscape/Objects/Cartoon/Drawing/Illustration/AI-generated (false)? Reply only JSON: {\"results\":[true,false,...]}" 
      },
    ];

    for (const base64 of images) {
      const url = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
      content.push({
        type: "image_url",
        image_url: { url, detail: "low" },
      });
    }

    // Timeout for resilience (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OPENAI_VISION_MODEL,
          messages: [
            { role: "system", content: "You are a strict data classifier. Always return valid JSON only, no extra text." },
            { role: "user", content }
          ],
          max_tokens: 150,
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Vision API error:", response.status, errorText);
        return { success: false, error: `OpenAI Vision API error: ${response.status}` };
      }

      const data = await response.json();
      const messageContent = data.choices?.[0]?.message?.content ?? "";
      
      // Log token usage for billing
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      console.log(`[BILLING] Batch human detection: ${images.length} photos. Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${promptTokens + completionTokens} total.`);

      // Parse JSON response (with json_object mode, should be clean)
      const parsed = JSON.parse(messageContent);
      const results = parsed.results;
      
      if (!Array.isArray(results) || results.length !== images.length) {
        console.error("Results array mismatch:", results);
        return { success: false, error: "Results count mismatch" };
      }
      
      return { success: true, results };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("Vision API timeout after 30 seconds");
        return { success: false, error: "Vision API timeout" };
      }
      throw fetchError; // Re-throw for outer catch
    }
  } catch (error) {
    console.error("Batch human detection failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Shared Image Moderation Helper
// ============================================================================

interface ImageModerationResult {
  approved: boolean;
  reason: "content_flagged" | "sensitive_content" | "not_human" | null;
  scores: Record<string, number> | null;
}

/**
 * Performs complete moderation on a single image:
 * 1. Safety check (sexual, violence, etc.)
 * 2. Human/Pet detection
 * 
 * This is the single source of truth for image moderation logic.
 * Used by both single and batch handlers.
 */
async function moderateSingleImage(base64Image: string): Promise<ImageModerationResult> {
  // Step 1: Safety check
  const safetyResult = await callOpenAIModeration("image", base64Image);
  
  if (!safetyResult.success) {
    console.error("[MODERATION] Safety check failed, rejecting:", safetyResult.error);
    return { approved: false, reason: "content_flagged", scores: null };
  }

  const { flagged, category_scores } = safetyResult.result!;

  // Check if flagged by OpenAI
  if (flagged) {
    console.log("[MODERATION] Image flagged by OpenAI safety check");
    return { approved: false, reason: "content_flagged", scores: category_scores };
  }

  // Check thresholds
  const thresholdReason = checkContentThresholds(category_scores, "image");
  if (thresholdReason) {
    console.log("[MODERATION] Image failed threshold check:", thresholdReason);
    return { approved: false, reason: "sensitive_content", scores: category_scores };
  }

  // Step 2: Human/Pet detection
  const humanDetection = await callBatchHumanDetection([base64Image]);
  
  console.log("[DEBUG] Human detection result:", JSON.stringify(humanDetection));
  
  if (!humanDetection.success || !humanDetection.results) {
    console.error("[MODERATION] Human detection failed, rejecting:", humanDetection.error);
    return { approved: false, reason: "not_human", scores: category_scores };
  }

  const isHumanOrPet = humanDetection.results[0];
  if (!isHumanOrPet) {
    console.log("[MODERATION] Image rejected: not human/pet");
    return { approved: false, reason: "not_human", scores: category_scores };
  }

  console.log("[MODERATION] Image approved: passed safety and human/pet check");
  return { approved: true, reason: null, scores: category_scores };
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

    const response: SingleModerationResponse = {
      approved: false,
      reason: "personal_data_detected",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // For images, use the shared helper (safety + human/pet detection)
  if (type === "image") {
    const result = await moderateSingleImage(content);
    
    await logModerationResult(
      supabase,
      userId,
      type,
      result.approved ? "approved" : "rejected",
      result.reason,
      result.scores
    );

    const response: SingleModerationResponse = {
      approved: result.approved,
      reason: result.reason,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // For text, use safety check only
  const moderationResult = await callOpenAIModeration(type, content);

  if (!moderationResult.success) {
    console.error("[MODERATION] Text safety check failed, rejecting:", moderationResult.error);
    await logModerationResult(supabase, userId, type, "rejected", "content_flagged", null);

    const response: SingleModerationResponse = {
      approved: false,
      reason: "content_flagged",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { flagged, category_scores } = moderationResult.result!;

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

  const response: SingleModerationResponse = { approved, reason };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
/**
 * Handles batch image moderation with human/pet detection
 * OPTIMIZED: Single Vision API call for all images instead of N calls
 * 
 * Flow:
 * 1. Run safety moderation on all images in parallel (free/cheap)
 * 2. Collect images that passed safety
 * 3. ONE call to Vision API for human/pet detection on all passed images
 * 4. Map results back to original indices
 */
async function handleBatchModeration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  images: string[]
): Promise<Response> {
  const imageCount = images.length;
  
  console.log(`[BILLING] Batch moderation started: ${imageCount} photos`);

  // Step 1: Run safety moderation on ALL images in parallel (cheap/free)
  const safetyResults = await Promise.all(
    images.map(async (base64, index) => {
      const result = await callOpenAIModeration("image", base64);
      
      if (!result.success) {
        console.warn(`[SAFETY] Image ${index}: API error, rejecting`);
        return { approved: false, reason: "content_flagged" as const };
      }

      const { flagged, category_scores } = result.result!;
      
      if (flagged) {
        console.log(`[SAFETY] Image ${index}: Flagged by OpenAI`);
        return { approved: false, reason: "content_flagged" as const };
      }

      const thresholdReason = checkContentThresholds(category_scores, "image");
      if (thresholdReason) {
        console.log(`[SAFETY] Image ${index}: Failed threshold - ${thresholdReason}`);
        return { approved: false, reason: "sensitive_content" as const };
      }

      return { approved: true, reason: null };
    })
  );

  // Step 2: Collect indices of images that passed safety
  const safeIndices: number[] = [];
  const safeImages: string[] = [];
  
  safetyResults.forEach((result, index) => {
    if (result.approved) {
      safeIndices.push(index);
      safeImages.push(images[index]);
    }
  });

  console.log(`[BATCH] Safety check complete: ${safeImages.length}/${imageCount} passed`);

  // Step 3: ONE Vision API call for human/pet detection on all safe images
  let humanResults: boolean[] = [];
  
  if (safeImages.length > 0) {
    const humanDetection = await callBatchHumanDetection(safeImages);
    
    if (humanDetection.success && humanDetection.results) {
      humanResults = humanDetection.results;
      console.log(`[BILLING] Vision Batch complete: ${safeImages.length} photos processed in ONE call.`);
    } else {
      // Fail-safe: approve all on detection error
      console.warn("[BATCH] Vision detection failed, approving all safe images");
      humanResults = safeImages.map(() => true);
    }
  }

  // Step 4: Build final results array, mapping Vision results back to original indices
  const finalResults: BatchModerationResponse["results"] = [];
  let humanResultIndex = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (let i = 0; i < imageCount; i++) {
    const safetyResult = safetyResults[i];
    
    if (!safetyResult.approved) {
      // Failed safety check
      finalResults.push({ approved: false, reason: safetyResult.reason });
      rejectedCount++;
    } else {
      // Passed safety - check Vision result
      const isHumanOrAnimal = humanResults[humanResultIndex++];
      if (isHumanOrAnimal) {
        finalResults.push({ approved: true, reason: null });
        approvedCount++;
      } else {
        finalResults.push({ approved: false, reason: "not_human" });
        rejectedCount++;
      }
    }
  }

  // Log batch result
  await logModerationResult(
    supabase,
    userId,
    "batch-images",
    rejectedCount > 0 ? "rejected" : "approved",
    rejectedCount > 0 ? `${rejectedCount} rejected` : null,
    null,
    imageCount
  );

  console.log(`[BILLING] Batch complete: ${approvedCount} approved, ${rejectedCount} rejected`);

  const response: BatchModerationResponse = {
    results: finalResults,
    processedCount: imageCount,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    return new Response(
      JSON.stringify({ error: "unauthorized", message: "Missing access token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!openaiApiKey) {
    console.error("Missing OPENAI_API_KEY");
    return new Response(
      JSON.stringify({ error: "server_error", message: "Moderation service unavailable" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Verify user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json() as ModerationRequest;

    // Handle batch images
    if (body.type === "batch-images") {
      const { images } = body as BatchModerationRequest;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        return new Response(
          JSON.stringify({ error: "bad_request", message: "Missing or empty images array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (images.length > 9) {
        return new Response(
          JSON.stringify({ error: "bad_request", message: "Maximum 9 images allowed per batch" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return handleBatchModeration(supabase, user.id, images);
    }

    // Handle single moderation (text or image)
    const { type, content } = body as SingleModerationRequest;

    if (!type || !content) {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "Missing type or content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type !== "text" && type !== "image") {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "Type must be 'text', 'image', or 'batch-images'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return handleSingleModeration(supabase, user.id, type, content);
  } catch (error) {
    console.error("moderate-content error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unable to moderate content";
    return new Response(
      JSON.stringify({
        error: "server_error",
        message: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
