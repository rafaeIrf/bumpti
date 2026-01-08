import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SettingItem } from "@/components/setting-item";
import { ThemedText } from "@/components/themed-text";
import ToggleSwitch from "@/components/toogle-switch";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useNotificationSettings } from "@/modules/profile/hooks/use-notification-settings";
import { useRouter } from "expo-router";
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

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.settingsPage.notifications.title")}
          leftAction={{
            icon: BackIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <View style={styles.container}>
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
              "screens.profile.settingsPage.notifications.nearbyActivity"
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
              "screens.profile.settingsPage.notifications.favoritePlaces"
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
