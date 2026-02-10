import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type OnboardingStep =
  | "user-name"
  | "user-age"
  | "user-gender"
  | "connect-with"
  | "intention"
  | "user-photos"
  | "user-bio"
  | "interests"
  | "university"
  | "favorite-places"
  | "location"
  | "notifications"
  | "tracking"
  | "complete";

export interface OnboardingUserData {
  name?: string;
  birthdate?: string;
  gender?: string;
  connectWith?: string[];
  intentions?: string[];
  photoUris?: string[];
  bio?: string;
  universityId?: string | null;
  universityName?: string | null;
  universityNameCustom?: string | null;
  universityLat?: number | null;
  universityLng?: number | null;
  graduationYear?: number | null;
  showUniversityOnHome?: boolean;
  interests?: string[];
  favoritePlaces?: string[];
  hasLocationPermission?: boolean;
  hasNotificationPermission?: boolean;
  hasTrackingPermission?: boolean;
  /** Auth provider used to sign in (e.g., "apple", "google", "email") */
  authProvider?: string;
}

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  userData: OnboardingUserData;
  isOnboardingComplete: boolean;
}

const initialState: OnboardingState = {
  currentStep: "user-name",
  completedSteps: [],
  userData: {},
  isOnboardingComplete: false,
};

const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {
    setCurrentStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.currentStep = action.payload;
    },
    completeStep: (state, action: PayloadAction<OnboardingStep>) => {
      if (!state.completedSteps.includes(action.payload)) {
        state.completedSteps.push(action.payload);
      }
    },
    setUserName: (state, action: PayloadAction<string>) => {
      state.userData.name = action.payload;
    },
    setUserBirthdate: (state, action: PayloadAction<string>) => {
      state.userData.birthdate = action.payload;
    },
    setUserGender: (state, action: PayloadAction<string>) => {
      state.userData.gender = action.payload;
    },
    setConnectWith: (state, action: PayloadAction<string[]>) => {
      state.userData.connectWith = action.payload;
    },
    setIntentions: (state, action: PayloadAction<string[]>) => {
      state.userData.intentions = action.payload;
    },
    setPhotoUris: (state, action: PayloadAction<string[]>) => {
      state.userData.photoUris = action.payload;
    },
    setBio: (state, action: PayloadAction<string>) => {
      state.userData.bio = action.payload;
    },
    setInterests: (state, action: PayloadAction<string[]>) => {
      state.userData.interests = action.payload;
    },
    setFavoritePlaces: (state, action: PayloadAction<string[]>) => {
      state.userData.favoritePlaces = action.payload;
    },
    setLocationPermission: (state, action: PayloadAction<boolean>) => {
      state.userData.hasLocationPermission = action.payload;
    },
    setNotificationPermission: (state, action: PayloadAction<boolean>) => {
      state.userData.hasNotificationPermission = action.payload;
    },
    setTrackingPermission: (state, action: PayloadAction<boolean>) => {
      state.userData.hasTrackingPermission = action.payload;
    },
    setAuthProvider: (state, action: PayloadAction<string>) => {
      state.userData.authProvider = action.payload;
    },
    completeOnboarding: (state) => {
      state.isOnboardingComplete = true;
      state.currentStep = "complete";
    },
    setUniversityData: (
      state,
      action: PayloadAction<{
        universityId?: string | null;
        universityName?: string | null;
        universityNameCustom?: string | null;
        universityLat?: number | null;
        universityLng?: number | null;
        graduationYear?: number | null;
        showUniversityOnHome?: boolean;
      }>
    ) => {
      const {
        universityId,
        universityName,
        universityNameCustom,
        universityLat,
        universityLng,
        graduationYear,
        showUniversityOnHome,
      } = action.payload;
      if (universityId !== undefined)
        state.userData.universityId = universityId;
      if (universityName !== undefined)
        state.userData.universityName = universityName;
      if (universityNameCustom !== undefined)
        state.userData.universityNameCustom = universityNameCustom;
      if (universityLat !== undefined)
        state.userData.universityLat = universityLat;
      if (universityLng !== undefined)
        state.userData.universityLng = universityLng;
      if (graduationYear !== undefined)
        state.userData.graduationYear = graduationYear;
      if (showUniversityOnHome !== undefined)
        state.userData.showUniversityOnHome = showUniversityOnHome;
    },
    resetOnboarding: () => initialState,
  },
});

export const {
  setCurrentStep,
  completeStep,
  setUserName,
  setUserBirthdate,
  setUserGender,
  setConnectWith,
  setIntentions,
  setPhotoUris,
  setBio,
  setInterests,
  setFavoritePlaces,
  setLocationPermission,
  setNotificationPermission,
  setTrackingPermission,
  setAuthProvider,
  completeOnboarding,
  setUniversityData,
  resetOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
