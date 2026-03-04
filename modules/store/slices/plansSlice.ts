import type { AllPlanFeedItem, UserPlan } from "@/modules/plans/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface PlansState {
  data: UserPlan[];
  loading: boolean;
  feed: AllPlanFeedItem[];
  feedLoading: boolean;
  feedInitialized: boolean;
}

const initialState: PlansState = {
  data: [],
  loading: false,
  feed: [],
  feedLoading: false,
  feedInitialized: false,
};

const plansSlice = createSlice({
  name: "plans",
  initialState,
  reducers: {
    setPlans(state, action: PayloadAction<UserPlan[]>) {
      state.data = action.payload;
    },
    setPlansLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setPlansFeed(state, action: PayloadAction<AllPlanFeedItem[]>) {
      state.feed = action.payload;
      state.feedInitialized = true;
    },
    setPlansFeedLoading(state, action: PayloadAction<boolean>) {
      state.feedLoading = action.payload;
    },
    clearPlans(state) {
      state.data = [];
      state.loading = false;
      state.feed = [];
      state.feedLoading = false;
      state.feedInitialized = false;
    },
  },
});

export const { setPlans, setPlansLoading, setPlansFeed, setPlansFeedLoading, clearPlans } = plansSlice.actions;
export default plansSlice.reducer;
