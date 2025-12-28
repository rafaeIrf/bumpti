import { useGetFavoritePlacesQuery } from "@/modules/places/placesApi";
import { useMemo } from "react";
import { useCachedLocation } from "./use-cached-location";

export function useFavoritePlacesList(enabled: boolean) {
  const { location: userLocation } = useCachedLocation();
  const queryArg = useMemo(
    () => ({
      lat: userLocation?.latitude,
      lng: userLocation?.longitude,
    }),
    [userLocation?.latitude, userLocation?.longitude]
  );
  const { data, isLoading, isFetching } = useGetFavoritePlacesQuery(queryArg, {
    skip: !enabled,
  });

  const favoritePlacesData = useMemo(
    () =>
      data?.places?.map((place: any) => ({
        placeId: place.placeId || place.id,
        name: place.name,
        type: place.types?.[0] || '',
        types: place.types || [],
        formattedAddress: place.formattedAddress || place.address || '',
        distance: place.distance || 0,
        latitude: place.latitude,
        longitude: place.longitude,
        active_users: place.active_users || 0,
        review: place.review,
      })) || [],
    [data?.places]
  );

  return useMemo(
    () => ({
      favoritePlacesData,
      favoritePlacesLoading: isLoading || isFetching,
      favoriteQueryArg: queryArg,
    }),
    [favoritePlacesData, isLoading, isFetching, queryArg]
  );
}
