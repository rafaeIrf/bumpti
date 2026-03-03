import { useCallback, useEffect } from "react";

import { useAppSelector } from "@/modules/store/hooks";
import { fetchAndSetPlansFeed } from "./api";
import type { ActivePlan } from "./hooks";
import type { AllPlanFeedItem, PlanPeriod } from "./types";

function feedItemToActivePlan(item: AllPlanFeedItem): ActivePlan {
  return {
    id: `${item.place_id}_${item.planned_for}_${item.planned_period}`,
    placeId: item.place_id,
    locationName: item.name,
    confirmedCount: item.plan_count,
    plannedFor: item.planned_for,
    plannedPeriod: item.planned_period as PlanPeriod,
    previewAvatars: item.preview_avatars ?? [],
    isOwn: false,
  };
}

/**
 * Reads community plan feed from Redux (preloaded in loadUserData).
 * Falls back to fetching if not yet available.
 * fetchAndSetPlansFeed resolves location internally.
 */
export function useAllPlansFeed() {
  const feed = useAppSelector((s) => s.plans.feed);
  const feedLoading = useAppSelector((s) => s.plans.feedLoading);
  const feedInitialized = useAppSelector((s) => s.plans.feedInitialized);

  // Fallback: if not yet initialized and not loading, trigger a fetch
  useEffect(() => {
    if (!feedInitialized && !feedLoading) {
      fetchAndSetPlansFeed();
    }
  }, [feedInitialized, feedLoading]);

  const refetch = useCallback(async () => {
    await fetchAndSetPlansFeed();
  }, []);

  const feedPlans = feed.map(feedItemToActivePlan);

  // Ready only after feed has been fetched at least once (feedInitialized set by setPlansFeed)
  const ready = feedInitialized;

  return { feedPlans, loading: feedLoading, ready, refetch };
}
