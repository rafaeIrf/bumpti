import { store } from "@/modules/store";
import { setPlans, setPlansLoading } from "@/modules/store/slices/plansSlice";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import type { CreatePlanPayload, UserPlan } from "./types";

export type PlanPresenceRecord = {
  id: string;
  user_id: string;
  place_id: string;
  entered_at: string;
  expires_at: string;
  ended_at: string | null;
  active: boolean;
  entry_type: "planning";
  planned_for: string;
  planned_period: string;
};

export async function createPlan(
  params: CreatePlanPayload
): Promise<PlanPresenceRecord | null> {
  try {
    const { placeId, period, day } = params;

    logger.debug("[createPlan] Creating plan:", { placeId, period, day });

    const { data, error } = await supabase.functions.invoke<{
      presence: PlanPresenceRecord;
    }>("create-plan", {
      body: {
        place_id: placeId,
        planned_for: day,
        planned_period: period,
      },
    });

    if (error) {
      logger.error("[createPlan] Edge function error:", { error });
      return null;
    }

    logger.log("[createPlan] Plan created successfully:", {
      presenceId: data?.presence?.id,
    });

    // Refresh plans in store after creating
    fetchAndSetUserPlans().catch(() => {});

    return data?.presence ?? null;
  } catch (err) {
    logger.error("[createPlan] Unexpected error:", { err });
    return null;
  }
}

/**
 * Fetches the user's active plans from the backend and updates the Redux store.
 * Called alongside fetchAndSetUserProfile in redux-provider.
 */
export async function fetchAndSetUserPlans(): Promise<UserPlan[]> {
  try {
    store.dispatch(setPlansLoading(true));

    const { data, error } = await supabase.functions.invoke<{
      plans: UserPlan[];
    }>("get-my-plans", {
      method: "GET",
    });

    if (error) {
      logger.error("[fetchAndSetUserPlans] Edge function error:", { error });
      store.dispatch(setPlans([]));
      return [];
    }

    const plans = data?.plans ?? [];
    logger.log("[fetchAndSetUserPlans] Fetched plans:", {
      count: plans.length,
    });

    store.dispatch(setPlans(plans));
    return plans;
  } catch (err) {
    logger.error("[fetchAndSetUserPlans] Unexpected error:", { err });
    store.dispatch(setPlans([]));
    return [];
  } finally {
    store.dispatch(setPlansLoading(false));
  }
}
