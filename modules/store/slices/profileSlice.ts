import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ProfileData = {
  id?: string;
  name?: string | null;
  birthdate?: string | null;
  gender?: string | null;
  connectWith?: string[];
  intentions?: string[];
  photos?: { url: string; position: number }[];
  updatedAt?: string | null;
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
