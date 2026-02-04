import { ArrowLeftIcon, SmartphoneIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PermissionBottomSheet } from "@/components/permission-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SettingItem } from "@/components/setting-item";
import { ThemedText } from "@/components/themed-text";
import ToggleSwitch from "@/components/toogle-switch";
import { BrandIcon } from "@/components/ui/brand-icon";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography } from "@/constants/theme";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useNotificationSettings } from "@/modules/profile/hooks/use-notification-settings";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";

// Arrow Left SVG for back button
const BackIcon = (props: any) => (
  <IconSymbol name="chevron.left" size={24} color={props.color} />
);

function SectionHeader({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <ThemedText
      style={[
        styles.sectionHeader,
        {
          color: colors.textSecondary,
        },
      ]}
    >
      {title}
    </ThemedText>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { settings, toggleSetting } = useNotificationSettings();
  const notificationPermission = useNotificationPermission();
  const bottomSheet = useCustomBottomSheet();

  const showPermissionBottomSheet = useCallback(() => {
    bottomSheet?.expand({
      content: () => (
        <PermissionBottomSheet
          renderIcon={() => <BrandIcon icon={SmartphoneIcon} size="lg" />}
          title={t("screens.onboarding.notificationsTitle")}
          subtitle={t("screens.onboarding.notificationsSubtitle")}
          enableButtonText={t("permissions.location.buttonSettings")}
          requestingText={t("screens.onboarding.notificationsRequesting")}
          skipButtonText={t("screens.onboarding.notificationsSkip")}
          isRequesting={false}
          canAskAgain={false}
          onEnable={() => {
            bottomSheet?.close();
            notificationPermission.openSettings();
          }}
          onSkip={() => bottomSheet?.close()}
          onOpenSettings={() => {
            bottomSheet?.close();
            notificationPermission.openSettings();
          }}
        />
      ),
      draggable: true,
    });
  }, [bottomSheet, notificationPermission]);

  const handlePermissionToggle = useCallback(async () => {
    if (notificationPermission.hasPermission) {
      // Already granted - open settings to revoke
      notificationPermission.openSettings();
    } else if (!notificationPermission.canAskAgain) {
      // Permission denied and can't ask again - show bottom sheet
      showPermissionBottomSheet();
    } else {
      // Can ask again - request permission
      const result = await notificationPermission.request();
      if (result.status !== "granted" && !result.canAskAgain) {
        showPermissionBottomSheet();
      }
    }
  }, [notificationPermission, showPermissionBottomSheet]);

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.settingsPage.notifications.title")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <View style={styles.container}>
        {/* Device Permission Section */}
        <SectionHeader
          title={t(
            "screens.profile.settingsPage.notifications.devicePermission",
          )}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t(
              "screens.profile.settingsPage.notifications.devicePermission",
            )}
            description={t(
              "screens.profile.settingsPage.notifications.devicePermissionDescription",
            )}
            showChevron={false}
            rightContent={
              <ToggleSwitch
                value={notificationPermission.hasPermission}
                onValueChange={handlePermissionToggle}
                colors={colors}
              />
            }
          />
        </View>

        {/* Push Notification Types Section */}
        <SectionHeader
          title={t("screens.profile.settingsPage.notifications.push")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t("screens.profile.settingsPage.notifications.matches")}
            showChevron={false}
            rightContent={
              <ToggleSwitch
                value={settings.matches}
                onValueChange={() => toggleSetting("matches")}
                colors={colors}
              />
            }
          />
          <SettingItem
            title={t("screens.profile.settingsPage.notifications.likes")}
            showChevron={false}
            rightContent={
              <ToggleSwitch
                value={settings.likes}
                onValueChange={() => toggleSetting("likes")}
                colors={colors}
              />
            }
          />
          <SettingItem
            title={t("screens.profile.settingsPage.notifications.messages")}
            showChevron={false}
            rightContent={
              <ToggleSwitch
                value={settings.messages}
                onValueChange={() => toggleSetting("messages")}
                colors={colors}
              />
            }
          />
          <SettingItem
            title={t(
              "screens.profile.settingsPage.notifications.nearbyActivity",
            )}
            showChevron={false}
            rightContent={
              <ToggleSwitch
                value={settings.nearby_activity}
                onValueChange={() => toggleSetting("nearby_activity")}
                colors={colors}
              />
            }
          />
          <SettingItem
            title={t(
              "screens.profile.settingsPage.notifications.favoritePlaces",
            )}
            showChevron={false}
            rightContent={
              <ToggleSwitch
                value={settings.favorite_places}
                onValueChange={() => toggleSetting("favorite_places")}
                colors={colors}
              />
            }
          />
        </View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.captionBold,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
  sectionGap: {
    gap: spacing.sm,
  },
});
