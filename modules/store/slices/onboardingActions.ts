import { store } from "@/modules/store";
import {
    completeOnboarding as completeOnboardingAction,
    completeStep as completeStepAction,
    OnboardingStep,
    resetOnboarding as resetOnboardingAction,
    setBio as setBioAction,
    setConnectWith as setConnectWithAction,
    setCurrentStep as setCurrentStepAction,
    setFavoritePlaces as setFavoritePlacesAction,
    setIntentions as setIntentionsAction,
    setLocationPermission as setLocationPermissionAction,
    setNotificationPermission as setNotificationPermissionAction,
    setPhotoUris as setPhotoUrisAction,
    setTrackingPermission as setTrackingPermissionAction,
    setUniversityData as setUniversityDataAction,
    setUserBirthdate as setUserBirthdateAction,
    setUserGender as setUserGenderAction,
    setUserName as setUserNameAction,
} from "./onboardingSlice";

// Action creators that encapsulate dispatch
export const onboardingActions = {
  setCurrentStep: (step: OnboardingStep) => {
    store.dispatch(setCurrentStepAction(step));
  },

  completeStep: (step: OnboardingStep) => {
    store.dispatch(completeStepAction(step));
  },

  setUserName: (name: string) => {
    store.dispatch(setUserNameAction(name));
  },

  setUserBirthdate: (birthdate: string) => {
    store.dispatch(setUserBirthdateAction(birthdate));
  },

  setUserGender: (gender: string) => {
    store.dispatch(setUserGenderAction(gender));
  },

  setConnectWith: (connectWith: string[]) => {
    store.dispatch(setConnectWithAction(connectWith));
  },

  setIntentions: (intentions: string[]) => {
    store.dispatch(setIntentionsAction(intentions));
  },

  setPhotoUris: (photoUris: string[]) => {
    store.dispatch(setPhotoUrisAction(photoUris));
  },

  setBio: (bio: string) => {
    store.dispatch(setBioAction(bio));
  },

  setFavoritePlaces: (favoritePlaces: string[]) => {
    store.dispatch(setFavoritePlacesAction(favoritePlaces));
  },

  setLocationPermission: (hasPermission: boolean) => {
    store.dispatch(setLocationPermissionAction(hasPermission));
  },

  setNotificationPermission: (hasPermission: boolean) => {
    store.dispatch(setNotificationPermissionAction(hasPermission));
  },

  setTrackingPermission: (hasPermission: boolean) => {
    store.dispatch(setTrackingPermissionAction(hasPermission));
  },

  setUniversityData: (data: {
    universityId?: string | null;
    universityName?: string | null;
    universityNameCustom?: string | null;
    universityLat?: number | null;
    universityLng?: number | null;
    graduationYear?: number | null;
    showUniversityOnHome?: boolean;
  }) => {
    store.dispatch(setUniversityDataAction(data));
  },

  completeOnboarding: () => {
    store.dispatch(completeOnboardingAction());
  },

  resetOnboarding: () => {
    store.dispatch(resetOnboardingAction());
  },
};

