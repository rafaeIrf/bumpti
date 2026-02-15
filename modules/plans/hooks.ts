import { useMemo } from "react";

import { useAppSelector } from "../store/hooks";
import type { PlanPeriod, UserPlan } from "./types";

const PERIOD_ORDER: Record<PlanPeriod, number> = {
  morning: 0,
  afternoon: 1,
  night: 2,
};

function getCurrentPeriod(): PlanPeriod {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "night";
}

export interface ActivePlan {
  id: string;
  placeId: string;
  locationName: string;
  confirmedCount: number;
  plannedFor: string;
  plannedPeriod: PlanPeriod;
}

function toActivePlan(p: UserPlan): ActivePlan {
  return {
    id: p.id,
    placeId: p.place_id,
    locationName: p.place_name ?? "",
    confirmedCount: p.active_users,
    plannedFor: p.planned_for,
    plannedPeriod: p.planned_period,
  };
}

/**
 * Returns the user's plans sorted by date + period, the most relevant
 * plan (nextPlan), and the index to start the carousel on.
 */
export function useUserPlans() {
  const plans = useAppSelector((state) => state.plans?.data ?? []);
  const loading = useAppSelector((state) => state.plans?.loading ?? false);

  const { sortedPlans, nextPlan, initialIndex } = useMemo(() => {
    if (plans.length === 0) {
      return { sortedPlans: [] as ActivePlan[], nextPlan: null, initialIndex: 0 };
    }

    // Sort all plans by date, then period
    const sorted = [...plans].sort((a, b) => {
      const dateCmp = a.planned_for.localeCompare(b.planned_for);
      if (dateCmp !== 0) return dateCmp;
      return PERIOD_ORDER[a.planned_period] - PERIOD_ORDER[b.planned_period];
    });

    const mapped = sorted.map(toActivePlan);

    // Find the most relevant plan index
    const today = new Date().toISOString().split("T")[0];
    const currentOrder = PERIOD_ORDER[getCurrentPeriod()];

    let bestIdx = mapped.findIndex(
      (p) => p.plannedFor === today && PERIOD_ORDER[p.plannedPeriod] >= currentOrder,
    );

    // Fallback: first today plan, then first future plan, then 0
    if (bestIdx === -1) {
      bestIdx = mapped.findIndex((p) => p.plannedFor === today);
    }
    if (bestIdx === -1) {
      bestIdx = mapped.findIndex((p) => p.plannedFor > today);
    }
    if (bestIdx === -1) bestIdx = 0;

    return {
      sortedPlans: mapped,
      nextPlan: mapped[bestIdx] ?? null,
      initialIndex: bestIdx,
    };
  }, [plans]);

  return { plans, sortedPlans, nextPlan, initialIndex, loading };
}
