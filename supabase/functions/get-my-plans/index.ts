/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { requireAuth } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { internalError, jsonOk, methodNotAllowed } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return methodNotAllowed();

  try {
    const authResult = await requireAuth(req);
    if (!authResult.success) return authResult.response;

    const { user } = authResult;
    const admin = createAdminClient();

    // Use client's local date if provided, fallback to UTC
    const localDate =
      req.headers.get("x-local-date") ??
      new Date().toISOString().split("T")[0];

    // Fetch active plans with place info
    const { data: plans, error } = await admin
      .from("user_presences")
      .select(`
        id, place_id, planned_for, planned_period, entered_at,
        places!inner ( name, category, neighborhood, street, house_number )
      `)
      .eq("user_id", user.id)
      .eq("entry_type", "planning")
      .eq("active", true)
      .gte("planned_for", localDate)
      .order("planned_for", { ascending: true });

    if (error) throw error;

    // Period sort order: morning → afternoon → night
    const periodOrder: Record<string, number> = {
      morning: 1,
      afternoon: 2,
      night: 3,
    };

    // Enrich each plan with eligible active users count
    const enriched = await Promise.all(
      (plans ?? []).map(async (plan: any) => {
        const { data: count } = await admin.rpc(
          "get_eligible_active_users_count",
          {
            target_place_id: plan.place_id,
            requesting_user_id: user.id,
            target_date: plan.planned_for,
          },
        );

        const street = plan.places?.street ?? "";
        const houseNumber = plan.places?.house_number ?? "";
        const address =
          [street, houseNumber].filter(Boolean).join(", ") || null;

        return {
          id: plan.id,
          place_id: plan.place_id,
          place_name: plan.places?.name ?? null,
          place_category: plan.places?.category ?? null,
          place_neighborhood: plan.places?.neighborhood ?? null,
          place_address: address,
          planned_for: plan.planned_for,
          planned_period: plan.planned_period,
          active_users: count ?? 0,
        };
      }),
    );

    // Sort by date (already sorted), then by period (morning → afternoon → night)
    enriched.sort((a, b) => {
      const dateComp = a.planned_for.localeCompare(b.planned_for);
      if (dateComp !== 0) return dateComp;
      return (periodOrder[a.planned_period] ?? 99) - (periodOrder[b.planned_period] ?? 99);
    });

    return jsonOk({ plans: enriched });
  } catch (err) {
    return internalError(err);
  }
});
