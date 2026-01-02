import { NavigationIcon, SmartphoneIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PermissionBottomSheet } from "@/components/permission-bottom-sheet";
import { BrandIcon } from "@/components/ui/brand-icon";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { t } from "@/modules/locales";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";

// Cooldown period for re-prompting permissions after user dismissal (in milliseconds)
// Best practice: 24 hours is recommended, with some apps using 48 hours
const PERMISSION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const STORAGE_KEYS = {
  LOCATION_DISMISSED_AT: "permission_location_dismissed_at",
  NOTIFICATION_DISMISSED_AT: "permission_notification_dismissed_at",
};

interface PermissionSheetContentProps {
  type: "location" | "notifications";
  onClose: () => void;
  onDismiss: () => void;
}

const PermissionSheetContent = ({
  type,
  onClose,
  onDismiss,
}: PermissionSheetContentProps) => {
  const locationPerm = useLocationPermission();
  const notifyPerm = useNotificationPermission();
  const [isRequesting, setIsRequesting] = useState(false);

  const isLocation = type === "location";
  const perm = isLocation ? locationPerm : notifyPerm;

  const handleEnable = async () => {
    setIsRequesting(true);
    const result = await perm.request();
    setIsRequesting(false);

    if (result.status === "granted") {
      // Refresh permission state to ensure hasPermission is updated
      await perm.refresh();
      // Mark as dismissed to prevent re-opening
      onDismiss();
      // Small delay to allow the system popup to disappear
      setTimeout(() => {
        onClose();
      }, 300);
    }
  };

  const handleSkip = () => {
    // Mark as dismissed BEFORE closing to prevent race condition
    onDismiss();
    onClose();
  };

  const handleOpenSettings = () => {
    onDismiss();
    onClose();
    perm.openSettings();
  };

  const renderIcon = () => (
    <BrandIcon icon={isLocation ? NavigationIcon : SmartphoneIcon} size="lg" />
  );

  return (
    <PermissionBottomSheet
      renderIcon={renderIcon}
      title={t(
        isLocation
          ? "permissions.location.title"
          : "screens.onboarding.notificationsTitle"
      )}
      subtitle={t(
        isLocation
          ? "permissions.location.subtitle"
          : "screens.onboarding.notificationsSubtitle"
      )}
      enableButtonText={t(
        isLocation
          ? "permissions.location.button"
          : "screens.onboarding.notificationsEnable"
      )}
      requestingText={t(
        isLocation
          ? "permissions.location.requesting"
          : "screens.onboarding.notificationsRequesting"
      )}
      skipButtonText={t(
        isLocation
          ? "permissions.location.skip"
          : "screens.onboarding.notificationsSkip"
      )}
      isRequesting={isRequesting}
      canAskAgain={perm.canAskAgain}
      onEnable={handleEnable}
      onSkip={handleSkip}
      onOpenSettings={handleOpenSettings}
    />
  );
};

/**
 * Check if enough time has passed since the last dismissal to show the permission sheet again.
 */
async function hasCooldownPassed(storageKey: string): Promise<boolean> {
  try {
    const dismissedAt = await AsyncStorage.getItem(storageKey);
    if (!dismissedAt) return true; // Never dismissed before

    const dismissedTimestamp = parseInt(dismissedAt, 10);
    const now = Date.now();
    return now - dismissedTimestamp >= PERMISSION_COOLDOWN_MS;
  } catch {
    return true; // On error, allow showing
  }
}

/**
 * Save the current timestamp as the dismissal time.
 */
async function saveDismissalTime(storageKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey, Date.now().toString());
  } catch {
    // Silently fail
  }
}

export function usePermissionSheet() {
  const bottomSheet = useCustomBottomSheet();
  const locationPerm = useLocationPermission();
  const notifyPerm = useNotificationPermission();
  const [dismissedLocation, setDismissedLocation] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(false);
  const [locationCooldownActive, setLocationCooldownActive] = useState(true);
  const [notificationCooldownActive, setNotificationCooldownActive] =
    useState(true);

  // Use refs to track if sheet was already shown this session
  const locationShownRef = useRef(false);
  const notificationShownRef = useRef(false);

  // Check cooldown status on mount
  useEffect(() => {
    (async () => {
      const locationCooldownPassed = await hasCooldownPassed(
        STORAGE_KEYS.LOCATION_DISMISSED_AT
      );
      const notificationCooldownPassed = await hasCooldownPassed(
        STORAGE_KEYS.NOTIFICATION_DISMISSED_AT
      );
      setLocationCooldownActive(!locationCooldownPassed);
      setNotificationCooldownActive(!notificationCooldownPassed);
    })();
  }, []);

  // Location is "handled" if permission granted OR explicitly dismissed OR in cooldown
  const locationHandled =
    locationPerm.hasPermission || dismissedLocation || locationCooldownActive;
  const notificationHandled =
    notifyPerm.hasPermission ||
    dismissedNotifications ||
    notificationCooldownActive;

  const handleLocationDismiss = useCallback(() => {
    setDismissedLocation(true);
    saveDismissalTime(STORAGE_KEYS.LOCATION_DISMISSED_AT);
  }, []);

  const handleNotificationDismiss = useCallback(() => {
    setDismissedNotifications(true);
    saveDismissalTime(STORAGE_KEYS.NOTIFICATION_DISMISSED_AT);
  }, []);

  const showLocationSheet = useCallback(() => {
    if (
      !bottomSheet ||
      locationPerm.hasPermission ||
      locationPerm.isLoading ||
      bottomSheet.isBottomSheetOpen ||
      dismissedLocation ||
      locationCooldownActive ||
      locationShownRef.current
    )
      return;

    locationShownRef.current = true;

    bottomSheet.expand({
      content: () => (
        <PermissionSheetContent
          type="location"
          onClose={() => bottomSheet.close()}
          onDismiss={handleLocationDismiss}
        />
      ),
      draggable: true,
    });
  }, [
    bottomSheet,
    locationPerm.hasPermission,
    locationPerm.isLoading,
    dismissedLocation,
    locationCooldownActive,
    handleLocationDismiss,
  ]);

  const showNotificationSheet = useCallback(() => {
    if (
      !bottomSheet ||
      notifyPerm.hasPermission ||
      notifyPerm.isLoading ||
      bottomSheet.isBottomSheetOpen ||
      dismissedNotifications ||
      notificationCooldownActive ||
      notificationShownRef.current
    )
      return;

    notificationShownRef.current = true;

    bottomSheet.expand({
      content: () => (
        <PermissionSheetContent
          type="notifications"
          onClose={() => bottomSheet.close()}
          onDismiss={handleNotificationDismiss}
        />
      ),
      draggable: true,
    });
  }, [
    bottomSheet,
    notifyPerm.hasPermission,
    notifyPerm.isLoading,
    dismissedNotifications,
    notificationCooldownActive,
    handleNotificationDismiss,
  ]);

  return {
    showLocationSheet,
    showNotificationSheet,
    hasLocationPermission: locationPerm.hasPermission,
    hasNotificationPermission: notifyPerm.hasPermission,
    locationHandled,
    notificationHandled,
    isLoading: locationPerm.isLoading || notifyPerm.isLoading,
  };
}
