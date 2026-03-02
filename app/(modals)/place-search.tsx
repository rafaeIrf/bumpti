import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { useScreenTracking } from "@/modules/analytics";
import { useLocalSearchParams } from "expo-router";
import React from "react";

export default function PlaceModal() {
  const params = useLocalSearchParams<{
    categoryFilter?: string;
  }>();

  useScreenTracking({
    screenName: "place_search",
    params: {
      category_filter: params.categoryFilter ?? "all",
    },
  });

  return <PlaceSearchContent categoryFilter={params.categoryFilter} />;
}
