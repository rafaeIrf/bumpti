/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { requireAuth } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import {
  internalError,
  jsonError,
  jsonOk,
  methodNotAllowed,
} from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// ── Types ────────────────────────────────────────────────────────────
interface CreatePlanInviteBody {
  presence_id: string;
}

const DEEPLINK_DOMAIN = Deno.env.get("DEEPLINK_DOMAIN") || "www.bumpti.com";
const INVITE_BASE_URL = `https://${DEEPLINK_DOMAIN}/invite/plan`;

// ── Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return methodNotAllowed();

  try {
    const [authResult, body] = await Promise.all([
      requireAuth(req),
      req.json().catch(() => null) as Promise<CreatePlanInviteBody | null>,
    ]);

    if (!authResult.success) return authResult.response;
    const { user } = authResult;

    if (!body?.presence_id || typeof body.presence_id !== "string") {
      return jsonError("invalid_presence_id", undefined, 400);
    }

    const admin = createAdminClient();

    // Verify the presence belongs to the user and is active
    const { data: presence, error: presenceErr } = await admin
      .from("user_presences")
      .select("id, expires_at, active")
      .eq("id", body.presence_id)
      .eq("user_id", user.id)
      .eq("entry_type", "planning")
      .eq("active", true)
      .maybeSingle();

    if (presenceErr) throw presenceErr;
    if (!presence) {
      return jsonError("presence_not_found", "Plan not found or not active", 404);
    }

    // Check if invite already exists for this presence (reuse token)
    const { data: existing } = await admin
      .from("plan_invites")
      .select("token, expires_at")
      .eq("presence_id", body.presence_id)
      .eq("creator_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      return jsonOk({
        token: existing.token,
        invite_url: `${INVITE_BASE_URL}/${existing.token}`,
        expires_at: existing.expires_at,
      });
    }

    // Create new invite
    const { data: invite, error: insertErr } = await admin
      .from("plan_invites")
      .insert({
        presence_id: body.presence_id,
        creator_id: user.id,
        expires_at: presence.expires_at,
      })
      .select("token, expires_at")
      .single();

    if (insertErr) throw insertErr;

    return jsonOk({
      token: invite.token,
      invite_url: `${INVITE_BASE_URL}/${invite.token}`,
      expires_at: invite.expires_at,
    }, 201);
  } catch (err) {
    return internalError(err);
  }
});
