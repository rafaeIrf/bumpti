/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { requireAuth } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { internalError, jsonOk, methodNotAllowed } from "../_shared/response.ts";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";
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

    const { data: rows, error } = await admin.rpc("get_all_plans_feed", {
      user_lat: lat,
      user_lng: lng,
      radius_meters: 50_000,
      requesting_user_id: user.id,
      start_date: localDate,
    });

    if (error) throw error;

    // Sign avatar URLs in parallel for each plan slot
    const plans = await Promise.all(
      (rows ?? []).map(async (r: any) => ({
        place_id: r.place_id,
        name: r.name,
        category: r.category ?? "",
        latitude: r.lat ?? 0,
        longitude: r.lng ?? 0,
        planned_for: r.planned_for,
        planned_period: r.planned_period,
        plan_count: r.plan_count ?? 0,
        preview_avatars: await signUserAvatars(admin, r.preview_avatars ?? []),
        distance: Math.round(r.dist_meters ?? 0),
      }))
    );

    return jsonOk({ plans });
  } catch (err) {
    return internalError(err);
  }
});
