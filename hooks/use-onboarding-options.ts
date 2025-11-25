import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { fetchOptions } from "@/modules/store/slices/optionsSlice";

export function useOnboardingOptions() {
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);

  useEffect(() => {
    const hasData =
      options.genders.length > 0 ||
      options.intentions.length > 0;
    if (!hasData || !options.loaded) {
      dispatch(fetchOptions());
    }
  }, [dispatch, options.genders.length, options.intentions.length, options.loaded]);

  return {
    genders: options.genders,
    intentions: options.intentions,
    isLoading: options.isLoading || !options.loaded,
    error: options.error,
    reload: () => dispatch(fetchOptions(true)),
    lastFetchedAt: options.lastFetchedAt,
  };
}
