import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
    internalError,
    jsonError,
    jsonOk,
    methodNotAllowed,
} from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    // Authenticate
    const auth = await requireAuth(req);
    if (!auth.success) return auth.response;

    const { user } = auth;
    const { place_id } = await req.json();

    if (!place_id) {
      return jsonError("missing_field", "place_id is required");
    }

    // Call the RPC with admin client (SECURITY DEFINER function)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient.rpc("get_vibe_check_data", {
      target_place_id: place_id,
      requesting_user_id: user.id,
    });

    if (error) {
      console.error("get_vibe_check_data RPC error:", error);
      return jsonError("rpc_error", error.message, 500);
    }

    return jsonOk(data);
  } catch (err) {
    return internalError(err);
  }
});
