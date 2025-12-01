import { store } from "@/modules/store";
import type { ProfileData } from "@/modules/store/slices/profileSlice";

export function getCurrentUserProfile(): ProfileData | null {
  return store.getState().profile.data ?? null;
}

export function getCurrentUserId(): string | null {
  return getCurrentUserProfile()?.id ?? null;
}
