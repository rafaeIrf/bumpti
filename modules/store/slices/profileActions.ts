import { store } from "@/modules/store";
import { calculateAge } from "@/utils/calculate-age";
import {
  ProfileData,
  resetProfile as resetProfileAction,
  setInvisibleMode as setInvisibleModeAction,
  setProfile as setProfileAction,
  setProfileLoading as setProfileLoadingAction,
  setSubscription as setSubscriptionAction,
  SubscriptionData,
} from "./profileSlice";

import { t } from "@/modules/locales";
import { updateProfilePhotos } from "@/modules/profile/api";
import { logger } from "@/utils/logger";
import { Alert } from "react-native";

export const setProfile = (data: ProfileData | null) => {
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
};

export const setProfileLoading = (isLoading: boolean) => {
  store.dispatch(setProfileLoadingAction(isLoading));
};

export const resetProfile = () => {
  store.dispatch(resetProfileAction());
};

export const setNotificationSettings = (settings: any) => {
    // any used temporarily to avoid circular deps if types are not exported/imported cleanly
    // ideally import NotificationSettings from profileSlice
    const { setNotificationSettings } = require("./profileSlice"); 
    store.dispatch(setNotificationSettings(settings));
};

let latestPhotoRequestId = 0;

export const updateProfilePhotosAction = async (newPhotos: string[], photoHashes?: Record<string, string>) => {
  // Increment request ID to track the latest request
  const requestId = ++latestPhotoRequestId;

  // 1. Optimistic Update
  const state = store.getState();
  const currentProfile = state.profile.data;
  
  if (!currentProfile) return;

  // Always apply optimistic update for immediate UI feedback
  const optimisticPhotos = newPhotos.map((url, index) => ({
    url,
    position: index,
  }));

  store.dispatch(setProfileAction({ ...currentProfile, photos: optimisticPhotos }));

  try {
    // 2. API Call
    const updatedProfile = await updateProfilePhotos(newPhotos, photoHashes);
    
    // Check if this is still the latest request
    if (requestId !== latestPhotoRequestId) {
      logger.debug(`[Profile] Ignoring stale photo update (req: ${requestId}, latest: ${latestPhotoRequestId})`);
      return;
    }

    if (updatedProfile?.photos) {
       // 3. Merge / Sync
       const freshState = store.getState();
       const freshProfile = freshState.profile.data;

       if(freshProfile) {
          // Merge logic to preserve stable URLs (prevent flickering)
          const returnedPhotos = updatedProfile.photos;
          const mergedPhotos = returnedPhotos.map((photo, index) => {
              const currentUrl = newPhotos[index];
              if (currentUrl && currentUrl.split("?")[0] === photo.url.split("?")[0]) {
                  return { ...photo, url: currentUrl };
              }
              return photo;
          });
          
          // Dispatch success with merged photos
          setProfile({ ...freshProfile, ...updatedProfile, photos: mergedPhotos });
       }
    }
    return updatedProfile;

  } catch (error: any) {
    // Check if this is still the latest request
    if (requestId !== latestPhotoRequestId) {
      logger.debug(`[Profile] Ignoring stale photo error (req: ${requestId}, latest: ${latestPhotoRequestId})`);
      return;
    }

    logger.error("Failed to update photos:", error);
    Alert.alert(t("common.error"), t("errors.generic"));
    
    // 4. Rollback
    store.dispatch(setProfileAction(currentProfile));
    
    throw error;
  }
};

export const handlePurchaseSuccess = (entitlements: SubscriptionData) => {
  logger.log("[ProfileActions] handlePurchaseSuccess called with entitlements:", entitlements);
  store.dispatch(setSubscriptionAction(entitlements));
};

export const setInvisibleMode = (isInvisible: boolean) => {
  store.dispatch(setInvisibleModeAction(isInvisible));
};
