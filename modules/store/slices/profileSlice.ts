import { calculateAge } from "@/utils/calculate-age";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ProfileData = {
  id?: string;
  name?: string | null;
  birthdate?: string | null;
  gender?: string | null;
  gender_id?: number | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  age?: number | null;
  connectWith?: string[];
  intentions?: string[];
  photos?: { url: string; position: number }[];
  updatedAt?: string | null;
  bio?: string | null;
  height_cm?: number | null;
  job_title?: string | null;
  company_name?: string | null;
  smoking_key?: string | null;
  education_key?: string | null;
  location?: string | null;
  languages?: string[] | null;
  zodiac_key?: string | null;
  relationship_key?: string | null;
  favoritePlaces?: any[] | null;
};

export interface ProfileState {
  data: ProfileData | null;
  isLoading: boolean;
}

const initialState: ProfileState = {
  data: null,
  isLoading: false,
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<ProfileData | null>) => {
      if (!action.payload) {
        state.data = null;
        return;
      }

      const derivedAge =
        action.payload.age !== undefined
          ? action.payload.age
          : calculateAge(action.payload.birthdate ?? null);

      state.data = { ...action.payload, age: derivedAge ?? null };
    },
    setProfileLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setFavoritePlaces: (state, action: PayloadAction<any[]>) => {
      if (state.data) {
        state.data.favoritePlaces = action.payload;
      }
    },
    resetProfile: () => initialState,
  },
});

export const {
  setProfile,
  setProfileLoading,
  setFavoritePlaces,
  resetProfile,
} = profileSlice.actions;

export default profileSlice.reducer;
