/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { handleCors } from "../_shared/cors.ts";
import {
    internalError,
    jsonError,
    jsonOk,
    methodNotAllowed,
} from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// ── Handler ──────────────────────────────────────────────────────────
// Public endpoint (no auth required) — allows invite preview before login
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return methodNotAllowed();

  try {
    const body = await req.json().catch(() => null) as { token?: string } | null;

    if (!body?.token || typeof body.token !== "string") {
      return jsonError("invalid_token", undefined, 400);
    }

    const admin = createAdminClient();

    // Fetch invite with presence and creator details
    const { data: invite, error } = await admin
      .from("plan_invites")
      .select(`
        id, token, expires_at, presence_id, creator_id,
        user_presences!inner (
          place_id, planned_for, planned_period, active, expires_at,
          places!inner ( name, category, neighborhood )
        )
      `)
      .eq("token", body.token)
      .maybeSingle();

    if (error) throw error;
    if (!invite) {
      return jsonError("invite_not_found", "Invite link not found", 404);
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return jsonError("invite_expired", "This plan invite has expired", 410);
    }

    // Check if presence is still active
    const presence = (invite as any).user_presences;
    if (!presence?.active) {
      return jsonError("plan_cancelled", "This plan has been cancelled", 410);
    }

    // Fetch creator's basic profile
    const { data: creator } = await admin
      .from("profiles")
      .select("display_name, photos")
      .eq("id", invite.creator_id)
      .maybeSingle();

    const place = presence.places;

    return jsonOk({
      invite: {
        token: invite.token,
        expires_at: invite.expires_at,
        presence_id: invite.presence_id,
        place_id: presence.place_id,
        place_name: place?.name ?? null,
        place_category: place?.category ?? null,
        place_neighborhood: place?.neighborhood ?? null,
        planned_for: presence.planned_for,
        planned_period: presence.planned_period,
        creator: {
          id: invite.creator_id,
          display_name: creator?.display_name ?? null,
          photo_url: creator?.photos?.[0] ?? null,
        },
      },
    });
  } catch (err) {
    return internalError(err);
  }
});
