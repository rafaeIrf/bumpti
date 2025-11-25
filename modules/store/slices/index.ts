// Export actions and types for easy imports
export { onboardingActions } from "./onboardingActions";
export type {
  OnboardingState,
  OnboardingStep,
  OnboardingUserData,
} from "./onboardingSlice";
export {
  setProfile,
  setProfileLoading,
  resetProfile,
  type ProfileData,
  type ProfileState,
} from "./profileSlice";
export { profileActions } from "./profileActions";
export {
  setFavorites,
  addFavoriteLocal,
  removeFavoriteLocal,
  setFavoritesLoading,
  setFavoritesError,
  setFavoritesLoaded,
  resetFavorites,
  fetchFavoritePlaces,
  toggleFavoritePlace,
  type FavoritesState,
} from "./favoritesSlice";
export {
  setOptions,
  setLoaded as setOptionsLoaded,
  setLastFetchedAt as setOptionsLastFetchedAt,
  setLoading as setOptionsLoading,
  setError as setOptionsError,
  resetOptions,
  fetchOptions,
  type OptionsState,
  type OnboardingOption as OnboardingOptionType,
} from "./optionsSlice";
