import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const DATABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface FeedbackPayload {
  rating_type: "positive" | "negative";
  message?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with anon key to properly respect RLS policies
    // The JWT in the Authorization header will set auth.uid() correctly
    const supabase = createClient(DATABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const payload: FeedbackPayload = await req.json();

    // Validate rating_type
    if (!["positive", "negative"].includes(payload.rating_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid rating_type. Must be 'positive' or 'negative'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get platform and app version from request headers
    const platform = req.headers.get("x-platform") || "unknown";
    const appVersion = req.headers.get("x-app-version") || "1.0.0";

    // Insert feedback record
    // RLS policy will check: auth.uid() = user_id
    const { error: insertError } = await supabase
      .from("app_feedback")
      .insert({
        user_id: user.id,
        rating_type: payload.rating_type,
        message: payload.message || null,
        platform,
        app_version: appVersion,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save feedback" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Feedback saved: ${payload.rating_type} from user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
