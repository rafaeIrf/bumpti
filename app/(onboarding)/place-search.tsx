import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { useScreenTracking } from "@/modules/analytics";
import React from "react";

export default function OnboardingPlaceSearchModal() {
  // Track screen view
  useScreenTracking({
    screenName: "onboarding_place_search",
    params: {
      step_name: "place_search",
    },
  });

  return <PlaceSearchContent />;
}
