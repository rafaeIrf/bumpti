import { useMemo } from "react";
import { useCachedLocation } from "./use-cached-location";
import { useGetFavoritePlacesQuery } from "@/modules/places/placesApi";

export interface FavoritePlaceResult {
  id: string;
  name: string;
  type: string;
  address: string;
  distance: number;
}

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
        id: place.placeId || place.id,
        name: place.name,
        type: place.type || "",
        address: place.formattedAddress || place.address || "",
        distance: place.distance || 0,
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
