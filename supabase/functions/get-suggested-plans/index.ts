/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { requireAuth } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { internalError, jsonOk, methodNotAllowed } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return methodNotAllowed();

  try {
    const authResult = await requireAuth(req);
    if (!authResult.success) return authResult.response;

    const { user } = authResult;
    const body = await req.json().catch(() => ({}));
    const lat = parseFloat(body.lat || "0");
    const lng = parseFloat(body.lng || "0");
    const localDate =
      body.local_date || new Date().toISOString().split("T")[0];

    const admin = createAdminClient();

    const { data: rows, error } = await admin.rpc("get_suggested_plans", {
      user_lat: lat,
      user_lng: lng,
      radius_meters: 50_000,
      requesting_user_id: user.id,
      target_date: localDate,
    });

    if (error) throw error;

    const suggestions = (rows ?? []).map((r: any) => ({
      place_id: r.place_id,
      name: r.name,
      category: r.category ?? "",
      latitude: r.lat ?? 0,
      longitude: r.lng ?? 0,
      plan_count: r.plan_count,
      distance: Math.round(r.dist_meters ?? 0),
    }));

    const total_count = rows?.[0]?.total_unique_users ?? 0;

    return jsonOk({ suggestions, total_count });
  } catch (err) {
    return internalError(err);
  }
});
