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
interface CreatePlanBody {
  place_id: string;
  planned_for: string; // YYYY-MM-DD (client local timezone)
  planned_period: "morning" | "afternoon" | "night";
  expires_at: string; // ISO 8601 (period-based, client-computed)
}

const VALID_PERIODS = ["morning", "afternoon", "night"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_DRIFT_DAYS = 2;

// ── Validation helpers ───────────────────────────────────────────────
function validateBody(body: CreatePlanBody | null) {
  if (!body?.place_id || typeof body.place_id !== "string") {
    return jsonError("invalid_place_id", undefined, 400);
  }

  if (!body.planned_for || !DATE_RE.test(body.planned_for)) {
    return jsonError("invalid_planned_for", "Must be YYYY-MM-DD", 400);
  }

  const clientDate = new Date(body.planned_for + "T12:00:00Z");
  const drift =
    Math.abs(clientDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (isNaN(clientDate.getTime()) || drift > MAX_DATE_DRIFT_DAYS) {
    return jsonError("invalid_planned_for", "Date out of acceptable range", 400);
  }

  if (!body.expires_at || isNaN(new Date(body.expires_at).getTime())) {
    return jsonError("invalid_expires_at", "Must be a valid ISO 8601 date", 400);
  }

  if (!body.planned_period || !VALID_PERIODS.includes(body.planned_period)) {
    return jsonError(
      "invalid_planned_period",
      `Must be one of: ${VALID_PERIODS.join(", ")}`,
      400,
    );
  }

  return null; // valid
}

// ── Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return methodNotAllowed();

  try {
    const [authResult, body] = await Promise.all([
      requireAuth(req),
      req.json().catch(() => null) as Promise<CreatePlanBody | null>,
    ]);

    if (!authResult.success) return authResult.response;
    const { user } = authResult;

    // Validate
    const validationError = validateBody(body);
    if (validationError) return validationError;

    const { place_id, planned_for, planned_period, expires_at } = body!;
    const admin = createAdminClient();

    // Check daily plan limit
    const [{ count, error: countErr }, { data: sub }] = await Promise.all([
      admin
        .from("user_presences")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("entry_type", "planning")
        .eq("planned_for", planned_for)
        .eq("active", true),
      admin
        .from("user_subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle(),
    ]);

    if (countErr) throw countErr;

    const dailyLimit = sub ? 10 : 2;
    const current = count ?? 0;
    if (current >= dailyLimit) {
      return jsonError("daily_plan_limit_reached", undefined, 403, {
        limit: dailyLimit,
        current,
      });
    }

    // Validate place
    const { data: place, error: placeErr } = await admin
      .from("places")
      .select("id")
      .eq("id", place_id)
      .eq("active", true)
      .maybeSingle();

    if (placeErr) throw placeErr;
    if (!place) return jsonError("place_not_found", undefined, 404);

    // Upsert presence
    const { data: existing } = await admin
      .from("user_presences")
      .select("id")
      .eq("user_id", user.id)
      .eq("place_id", place_id)
      .eq("entry_type", "planning")
      .eq("planned_for", planned_for)
      .eq("active", true)
      .maybeSingle();

    if (existing) {
      const { data, error } = await admin
        .from("user_presences")
        .update({ planned_period, expires_at })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return jsonOk({ presence: data }, 200);
    }

    const { data, error } = await admin
      .from("user_presences")
      .insert({
        user_id: user.id,
        place_id,
        active: true,
        entry_type: "planning",
        planned_for,
        planned_period,
        expires_at,
        lat: null,
        lng: null,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonOk({ presence: data }, 201);
  } catch (err) {
    return internalError(err);
  }
});
