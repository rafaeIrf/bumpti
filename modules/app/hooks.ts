import { useAppSelector } from "@/modules/store/hooks";
import { selectActiveCategories } from "@/modules/store/slices/appSlice";

/**
 * Hook to get active categories from remote config via Redux.
 * Returns the list of categories enabled in app_config.
 */
export const useActiveCategories = () => {
  return useAppSelector(selectActiveCategories);
};
