import {
  getOnboardingOptions,
  OnboardingOption,
} from "@/modules/onboarding/onboarding-service";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../index";

export interface OptionsState {
  genders: OnboardingOption[];
  intentions: OnboardingOption[];
  loaded: boolean;
  lastFetchedAt: number | null;
  isLoading: boolean;
  error?: string;
}

const initialState: OptionsState = {
  genders: [],
  intentions: [],
  loaded: false,
  lastFetchedAt: null,
  isLoading: false,
  error: undefined,
};

const optionsSlice = createSlice({
  name: "options",
  initialState,
  reducers: {
    setOptions: (
      state,
      action: PayloadAction<{
        genders: OnboardingOption[];
        intentions: OnboardingOption[];
      }>
    ) => {
      state.genders = action.payload.genders;
      state.intentions = action.payload.intentions;
    },
    setLoaded: (state, action: PayloadAction<boolean>) => {
      state.loaded = action.payload;
    },
    setLastFetchedAt: (state, action: PayloadAction<number | null>) => {
      state.lastFetchedAt = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },
    resetOptions: () => initialState,
  },
});

export const {
  setOptions,
  setLoaded,
  setLastFetchedAt,
  setLoading,
  setError,
  resetOptions,
} = optionsSlice.actions;

export const fetchOptions =
  (force = false) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    const { options } = getState();
    if (options.isLoading) return;

    dispatch(setLoading(true));
    dispatch(setError(undefined));

    try {
      const data = await getOnboardingOptions();

      dispatch(
        setOptions({
          genders: data.genders,
          intentions: data.intentions,
        })
      );
      dispatch(setLoaded(true));
    } catch (err: any) {
      dispatch(
        setError(err?.message || "Não foi possível carregar as opções.")
      );
    } finally {
      dispatch(setLoading(false));
    }
  };

export default optionsSlice.reducer;
export type { OnboardingOption };
