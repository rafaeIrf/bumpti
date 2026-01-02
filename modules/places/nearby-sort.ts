import { SortOption } from "@/components/places-filter-bottom-sheet";

export const getEffectiveSortBy = (
  isNearbyMode: boolean,
  sortBy: SortOption
): SortOption => {
  return isNearbyMode ? "distance" : sortBy;
};
