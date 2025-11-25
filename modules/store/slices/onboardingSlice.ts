import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type OnboardingStep =
  | "phone-auth"
  | "verify-code"
  | "user-name"
  | "user-age"
  | "user-gender"
  | "connect-with"
  | "intention"
  | "user-photos"
  | "location"
  | "notifications"
  | "complete";

export interface OnboardingUserData {
  name?: string;
  birthdate?: string;
  gender?: string;
  connectWith?: string[];
  intentions?: string[];
  photoUris?: string[];
  hasLocationPermission?: boolean;
  hasNotificationPermission?: boolean;
}

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  userData: OnboardingUserData;
  isOnboardingComplete: boolean;
}

const initialState: OnboardingState = {
  currentStep: "phone-auth",
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
    setLocationPermission: (state, action: PayloadAction<boolean>) => {
      state.userData.hasLocationPermission = action.payload;
    },
    setNotificationPermission: (state, action: PayloadAction<boolean>) => {
      state.userData.hasNotificationPermission = action.payload;
    },
    completeOnboarding: (state) => {
      state.isOnboardingComplete = true;
      state.currentStep = "complete";
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
  setLocationPermission,
  setNotificationPermission,
  completeOnboarding,
  resetOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
