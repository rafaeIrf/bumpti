import { store } from "@/modules/store";
import {
  resetProfile as resetProfileAction,
  setProfile as setProfileAction,
  setProfileLoading as setProfileLoadingAction,
  ProfileData,
} from "./profileSlice";
import { calculateAge } from "@/utils/calculate-age";

export const profileActions = {
  setProfile: (data: ProfileData | null) => {
    if (!data) {
      store.dispatch(setProfileAction(null));
      return;
    }

    const derivedAge =
      data.age !== undefined ? data.age : calculateAge(data.birthdate ?? null);

    store.dispatch(
      setProfileAction({
        ...data,
        age: derivedAge ?? null,
      })
    );
  },
  setProfileLoading: (isLoading: boolean) => {
    store.dispatch(setProfileLoadingAction(isLoading));
  },
  resetProfile: () => {
    store.dispatch(resetProfileAction());
  },
};
