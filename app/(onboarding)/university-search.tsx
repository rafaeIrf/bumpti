import { PlaceSearchContent } from "@/components/place-search/place-search-content";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useScreenTracking } from "@/modules/analytics";
import { useGetSuggestedPlacesQuery } from "@/modules/places/placesApi";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import { useMemo } from "react";

export default function UniversitySearchModal() {
  const router = useRouter();
  const { location } = useCachedLocation();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_university_search",
    params: {
      step_name: "university_search",
    },
  });

  // Fetch suggested universities via get-suggested-places edge function (50km radius)
  const { data: suggestedData, isFetching: suggestedLoading } =
    useGetSuggestedPlacesQuery(
      {
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        categories: ["university"] as any,
      },
      { skip: !location },
    );

  const suggestedPlaces = useMemo(() => {
    const places = suggestedData?.data?.[0]?.places;
    if (!places) return [];
    return places.slice(0, 9).map((p: any) => ({
      id: p.placeId,
      name: p.name,
      address: p.formattedAddress,
    }));
  }, [suggestedData]);

  const handleUniversitySelect = (place: {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  }) => {
    logger.log("[UniversitySearchModal] Selected university:", place.name);

    // Call the callback from university screen
    // @ts-ignore
    const callback = globalThis.__universitySearchCallback;
    if (typeof callback === "function") {
      callback(place);
    }

    router.back();
  };

  return (
    <PlaceSearchContent
      autoFocus
      isModal
      categoryFilter="university"
      onUniversitySelect={handleUniversitySelect}
      suggestedPlaces={suggestedPlaces}
      suggestedPlacesLoading={suggestedLoading}
    />
  );
}
