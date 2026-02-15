import type { UserPlan } from "@/modules/plans/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface PlansState {
  data: UserPlan[];
  loading: boolean;
}

const initialState: PlansState = {
  data: [],
  loading: false,
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
    clearPlans(state) {
      state.data = [];
      state.loading = false;
    },
  },
});

export const { setPlans, setPlansLoading, clearPlans } = plansSlice.actions;
export default plansSlice.reducer;
