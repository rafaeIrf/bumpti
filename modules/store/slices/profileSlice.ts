import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ProfileData = {
  id?: string;
  name?: string | null;
  birthdate?: string | null;
  gender?: string | null;
  gender_id?: number | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  connectWith?: number[];
  intentions?: number[];
  photos?: { url: string; position: number }[];
  updatedAt?: string | null;
  bio?: string | null;
  height_cm?: number | null;
  profession?: string | null;
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
      state.data = action.payload;
    },
    setProfileLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    resetProfile: () => initialState,
  },
});

export const { setProfile, setProfileLoading, resetProfile } =
  profileSlice.actions;

export default profileSlice.reducer;
