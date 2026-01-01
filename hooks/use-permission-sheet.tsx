import { NavigationIcon, SmartphoneIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PermissionBottomSheet } from "@/components/permission-bottom-sheet";
import { BrandIcon } from "@/components/ui/brand-icon";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { t } from "@/modules/locales";
import React, { useCallback, useRef, useState } from "react";

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
        `screens.onboarding.${isLocation ? "location" : "notifications"}Title`
      )}
      subtitle={t(
        `screens.onboarding.${
          isLocation ? "location" : "notifications"
        }Subtitle`
      )}
      enableButtonText={t(
        `screens.onboarding.${isLocation ? "location" : "notifications"}Enable`
      )}
      requestingText={t(
        `screens.onboarding.${
          isLocation ? "location" : "notifications"
        }Requesting`
      )}
      skipButtonText={t(
        `screens.onboarding.${isLocation ? "location" : "notifications"}Skip`
      )}
      isRequesting={isRequesting}
      canAskAgain={perm.canAskAgain}
      onEnable={handleEnable}
      onSkip={handleSkip}
      onOpenSettings={handleOpenSettings}
    />
  );
};

export function usePermissionSheet() {
  const bottomSheet = useCustomBottomSheet();
  const locationPerm = useLocationPermission();
  const notifyPerm = useNotificationPermission();
  const [dismissedLocation, setDismissedLocation] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(false);

  // Use refs to track if sheet was already shown this session
  const locationShownRef = useRef(false);
  const notificationShownRef = useRef(false);

  // Location is "handled" if permission granted OR explicitly dismissed
  const locationHandled = locationPerm.hasPermission || dismissedLocation;
  const notificationHandled =
    notifyPerm.hasPermission || dismissedNotifications;

  const showLocationSheet = useCallback(() => {
    if (
      !bottomSheet ||
      locationPerm.hasPermission ||
      locationPerm.isLoading ||
      bottomSheet.isBottomSheetOpen ||
      dismissedLocation ||
      locationShownRef.current
    )
      return;

    locationShownRef.current = true;

    bottomSheet.expand({
      content: () => (
        <PermissionSheetContent
          type="location"
          onClose={() => bottomSheet.close()}
          onDismiss={() => setDismissedLocation(true)}
        />
      ),
      draggable: true,
    });
  }, [
    bottomSheet,
    locationPerm.hasPermission,
    locationPerm.isLoading,
    dismissedLocation,
  ]);

  const showNotificationSheet = useCallback(() => {
    if (
      !bottomSheet ||
      notifyPerm.hasPermission ||
      notifyPerm.isLoading ||
      bottomSheet.isBottomSheetOpen ||
      dismissedNotifications ||
      notificationShownRef.current
    )
      return;

    notificationShownRef.current = true;

    bottomSheet.expand({
      content: () => (
        <PermissionSheetContent
          type="notifications"
          onClose={() => bottomSheet.close()}
          onDismiss={() => setDismissedNotifications(true)}
        />
      ),
      draggable: true,
    });
  }, [
    bottomSheet,
    notifyPerm.hasPermission,
    notifyPerm.isLoading,
    dismissedNotifications,
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
