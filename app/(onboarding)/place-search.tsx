import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { useScreenTracking } from "@/modules/analytics";
import React from "react";

export default function OnboardingPlaceSearchModal() {
  // Track screen view
  useScreenTracking("onboarding_place_search", {
    onboarding_step: 9,
    step_name: "place_search",
  });

  return <PlaceSearchContent />;
}
