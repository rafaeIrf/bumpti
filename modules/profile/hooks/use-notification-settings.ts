import { updateNotificationSettings } from "@/modules/profile/api";
import { NotificationSettings } from "@/modules/profile/types";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setNotificationSettings } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";

export function useNotificationSettings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(
    (state) => state.profile.data?.notificationSettings
  );

  // Default settings if none exist
  const currentSettings: NotificationSettings = settings || {
    favorite_places: true,
    nearby_activity: true,
    messages: true,
    matches: true,
  };

  const toggleSetting = async (key: keyof NotificationSettings) => {
    const oldSettings = { ...currentSettings };
    const newSettings = { ...currentSettings, [key]: !currentSettings[key] };

    // Optimistic update - dispatch to Redux immediately
    dispatch(setNotificationSettings(newSettings));

    try {
      await updateNotificationSettings({ [key]: newSettings[key] });
      logger.log(`Updated notification setting ${key} to ${newSettings[key]}`);
    } catch (error) {
      logger.error(`Failed to update setting ${key}`, error);
      // Revert on error
      dispatch(setNotificationSettings(oldSettings));
    }
  };

  return { settings: currentSettings, toggleSetting };
}
