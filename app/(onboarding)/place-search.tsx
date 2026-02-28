import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { useGetNearbyPlacesQuery } from "@/modules/places/placesApi";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";

export default function OnboardingPlaceSearchModal() {
  const params = useLocalSearchParams<{
    categoryFilter?: string;
  }>();

  const { location: userLocation } = useCachedLocation();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_place_search",
    params: {
      step_name: "place_search",
      category_filter: params.categoryFilter ?? "all",
    },
  });

  // Fetch top 20 nearby places for the selected category
  const categoryArray = useMemo(
    () => (params.categoryFilter ? params.categoryFilter.split(",") : []),
    [params.categoryFilter],
  );

  const { data: nearbyPlaces, isLoading: nearbyLoading } =
    useGetNearbyPlacesQuery(
      {
        latitude: userLocation?.latitude ?? 0,
        longitude: userLocation?.longitude ?? 0,
        category: categoryArray,
        pageSize: 20,
        sortBy: "relevance",
      },
      {
        skip: !userLocation || categoryArray.length === 0,
      },
    );

  const suggestedPlaces = useMemo(() => {
    if (!nearbyPlaces) return [];
    return nearbyPlaces.map((p) => ({
      id: p.placeId,
      name: p.name,
      address: p.formattedAddress,
      distance: p.distance,
    }));
  }, [nearbyPlaces]);

  // Resolve category-specific placeholder
  const firstCategory = categoryArray[0];
  const categoryPlaceholder = firstCategory
    ? t(`screens.placeSearch.categoryPlaceholder.${firstCategory}`)
    : undefined;

  return (
    <PlaceSearchContent
      categoryFilter={params.categoryFilter}
      suggestedPlaces={suggestedPlaces}
      suggestedPlacesLoading={nearbyLoading}
      placeholder={categoryPlaceholder}
    />
  );
}
