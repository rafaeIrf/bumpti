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

const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";
const OPENAI_MODEL = "omni-moderation-latest";

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

interface ModerationRequest {
  type: "text" | "image";
  content: string;
}

interface ModerationResponse {
  approved: boolean;
  reason: "content_flagged" | "sensitive_content" | "personal_data_detected" | null;
}

interface OpenAIModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

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
 */
async function logModerationResult(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  contentType: "text" | "image",
  result: "approved" | "rejected" | "pending",
  reason: string | null
): Promise<void> {
  await supabase.from("content_moderation_logs").insert({
    user_id: userId,
    content_type: contentType,
    result,
    reason,
  });
}

/**
 * Calls OpenAI Moderation API
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
        model: OPENAI_MODEL,
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
    return { success: false, error: error?.message ?? "Unknown error" };
  }
}

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
    const { type, content } = body;

    if (!type || !content) {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "Missing type or content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type !== "text" && type !== "image") {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "Type must be 'text' or 'image'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for personal data in text content first (before calling OpenAI)
    if (type === "text" && containsPersonalData(content)) {
      await logModerationResult(supabase, user.id, type, "rejected", "personal_data_detected");

      const response: ModerationResponse = {
        approved: false,
        reason: "personal_data_detected",
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI Moderation API
    const moderationResult = await callOpenAIModeration(type, content);

    // FAIL-SAFE: If OpenAI fails, approve but log as pending for manual review
    if (!moderationResult.success) {
      console.warn("OpenAI moderation failed, applying fail-safe approval:", moderationResult.error);
      await logModerationResult(supabase, user.id, type, "pending", moderationResult.error ?? "openai_unavailable");

      const response: ModerationResponse = {
        approved: true,
        reason: null,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { flagged, category_scores } = moderationResult.result!;

    // LOG ALL SCORES FOR DEBUGGING
    console.log("OpenAI moderation scores:", JSON.stringify({
      flagged,
      scores: category_scores,
      content_type: type,
    }));

    // Decision logic
    let approved = true;
    let reason: ModerationResponse["reason"] = null;

    // Check 1: Auto-reject if flagged by OpenAI
    if (flagged) {
      approved = false;
      reason = "content_flagged";
    }
    // Check 2: Check all category thresholds (even if not flagged)
    else {
      const thresholdReason = checkContentThresholds(category_scores, type);
      if (thresholdReason) {
        approved = false;
        reason = thresholdReason as ModerationResponse["reason"];
      }
    }

    // Log the result
    await logModerationResult(
      supabase,
      user.id,
      type,
      approved ? "approved" : "rejected",
      reason
    );

    const response: ModerationResponse = { approved, reason };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("moderate-content error:", error);
    return new Response(
      JSON.stringify({
        error: "server_error",
        message: error?.message ?? "Unable to moderate content",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
