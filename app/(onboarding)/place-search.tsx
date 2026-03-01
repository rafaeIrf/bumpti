import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { useScreenTracking } from "@/modules/analytics";
import { useLocalSearchParams } from "expo-router";
import React from "react";

export default function OnboardingPlaceSearchModal() {
  const params = useLocalSearchParams<{
    categoryFilter?: string;
  }>();

  useScreenTracking({
    screenName: "onboarding_place_search",
    params: {
      step_name: "place_search",
      category_filter: params.categoryFilter ?? "all",
    },
  });

  return <PlaceSearchContent categoryFilter={params.categoryFilter} />;
}
