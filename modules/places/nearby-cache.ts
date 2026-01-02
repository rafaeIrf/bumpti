import { Place } from "@/modules/places/types";

export type NearbySortOption = "relevance" | "distance" | "popularity" | "rating";

export type NearbyPlacesQueryArgs = {
  latitude: number;
  longitude: number;
  category: string[];
  page?: number;
  pageSize?: number;
  sortBy?: NearbySortOption;
  minRating?: number | null;
};

const GRID_SIZE = 0.002;

export const roundToGrid = (coord: number): number =>
  Math.round(coord / GRID_SIZE) * GRID_SIZE;

export const buildNearbyCacheKey = (
  args: NearbyPlacesQueryArgs,
  endpointName = "getNearbyPlaces"
): string => {
  const normalized = {
    lat: roundToGrid(args.latitude),
    lng: roundToGrid(args.longitude),
    category: [...args.category].sort(),
    pageSize: args.pageSize ?? 20,
    sortBy: args.sortBy ?? "relevance",
    minRating: args.minRating ?? "all",
  };

  return `${endpointName}-${JSON.stringify(normalized)}`;
};

export const mergeNearbyPlaces = (
  currentCache: Place[],
  newItems: Place[],
  page: number
): Place[] => {
  if (page === 1) {
    if (currentCache.length > newItems.length) {
      return [...newItems, ...currentCache.slice(newItems.length)];
    }
    return newItems;
  }

  const existing = new Set(currentCache.map((place) => place.placeId));
  const deduped = newItems.filter((place) => !existing.has(place.placeId));
  return [...currentCache, ...deduped];
};

export const shouldRefetchNearby = (
  currentArg?: NearbyPlacesQueryArgs,
  previousArg?: NearbyPlacesQueryArgs
): boolean => {
  if (!currentArg || !previousArg) return false;
  const currentPage = currentArg.page ?? 1;
  const previousPage = previousArg.page ?? 1;
  return currentPage > previousPage;
};
