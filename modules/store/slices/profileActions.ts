import { store } from "@/modules/store";
import {
  resetProfile as resetProfileAction,
  setProfile as setProfileAction,
  setProfileLoading as setProfileLoadingAction,
  ProfileData,
} from "./profileSlice";

export const profileActions = {
  setProfile: (data: ProfileData | null) => {
    store.dispatch(setProfileAction(data));
  },
  setProfileLoading: (isLoading: boolean) => {
    store.dispatch(setProfileLoadingAction(isLoading));
  },
  resetProfile: () => {
    store.dispatch(resetProfileAction());
  },
};
