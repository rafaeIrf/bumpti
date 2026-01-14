import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SettingItem } from "@/components/setting-item";
import { ThemedText } from "@/components/themed-text";
import ToggleSwitch from "@/components/toogle-switch";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { phoneAuthService } from "@/modules/auth/phone-auth-service";
import { t } from "@/modules/locales";
import { useInvisibleMode } from "@/modules/profile/hooks/use-invisible-mode";
import { openEmail, openPrivacyPolicy, openTermsOfUse } from "@/utils/linking";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, StyleSheet, View } from "react-native";

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
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

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { profile } = useProfile();
  const { isInvisible, toggleInvisibleMode, isPremium } = useInvisibleMode();

  const handleClose = () => {
    router.back();
  };

  const handleVerifyProfile = () => {
    // Navigate directly to verification modal
    // The modal will handle loading and fetching the session
    router.push("/(modals)/verification-webview");
  };

  const handleLogout = () => {
    Alert.alert(
      t("screens.profile.settingsPage.session.logout"),
      t("screens.profile.settingsPage.session.logoutConfirm"), // You might need to add this key
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("screens.profile.settingsPage.session.logout"),
          style: "destructive",
          onPress: async () => {
            try {
              await phoneAuthService.signOut();
              router.replace("/(auth)/welcome");
            } catch (error) {
              logger.error("Error signing out:", error);
              Alert.alert(t("errors.generic"));
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("screens.profile.settingsPage.session.deleteAccount"),
      t("screens.profile.settingsPage.session.deleteAccountConfirm"), // You might need to add this key
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await phoneAuthService.deleteAccount();
              // Dismiss all modals/screens first, then replace to clear history
              while (router.canGoBack()) {
                router.back();
              }
              router.replace("/(auth)/welcome");
            } catch (error) {
              logger.error("Error deleting account:", error);
              Alert.alert(t("errors.generic"));
            }
          },
        },
      ]
    );
  };

  const TopHeader = (
    <ScreenToolbar
      title={t("screens.profile.settingsPage.title")}
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: handleClose,
        ariaLabel: t("common.close") || "Close",
      }}
    />
  );

  return (
    <BaseTemplateScreen TopHeader={TopHeader}>
      <View style={styles.container}>
        {/* Preferências de Presença */}
        <SectionHeader
          title={t("screens.profile.settingsPage.presence.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t("screens.profile.settingsPage.presence.invisible")}
            description={t(
              "screens.profile.settingsPage.presence.invisibleDescription"
            )}
            rightContent={
              <View style={styles.invisibleToggleContainer}>
                {!isPremium && (
                  <View style={[styles.premiumBadge, { backgroundColor: colors.accent }]}>
                    <ThemedText style={styles.premiumBadgeText}>Premium</ThemedText>
                  </View>
                )}
                <ToggleSwitch
                  value={isInvisible}
                  onValueChange={toggleInvisibleMode}
                  colors={colors}
                />
              </View>
            }
            showChevron={false}
          />
        </View>

        {/* Notificações */}
        <SectionHeader
          title={t("screens.profile.settingsPage.notifications.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t("screens.profile.settingsPage.notifications.push")}
            onClick={() => router.push("/main/notification-settings")}
          />
        </View>

        {/* Conta */}
        <SectionHeader
          title={t("screens.profile.settingsPage.account.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t("screens.profile.settingsPage.account.blockList")}
            description={t(
              "screens.profile.settingsPage.account.blockListDescription"
            )}
            onClick={() => router.push("/main/blocked-list")}
          />
          {/* Verification button - only show if not verified */}
          {profile?.verification_status !== "verified" && (
            <SettingItem
              title={t("screens.profile.settingsPage.account.verifyProfile")}
              description={
                profile?.verification_status === "pending"
                  ? t("screens.profile.settingsPage.account.verification.retryDescription")
                  : undefined
              }
              onClick={handleVerifyProfile}
            />
          )}
        </View>

        {/* Segurança e Privacidade */}
        <SectionHeader
          title={t("screens.profile.settingsPage.security.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t("screens.profile.settingsPage.security.privacyPolicy")}
            onClick={openPrivacyPolicy}
          />
          <SettingItem
            title={t("screens.profile.settingsPage.security.terms")}
            onClick={openTermsOfUse}
          />
        </View>

        {/* Suporte */}
        <SectionHeader
          title={t("screens.profile.settingsPage.support.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            title={t("screens.profile.settingsPage.support.help")}
            onClick={() => openEmail(undefined, "Help & Support")}
          />
          <SettingItem
            title={t("screens.profile.settingsPage.support.report")}
            onClick={() => openEmail(undefined, "Report a problem")}
          />
        </View>

        {/* Sobre */}
        <SectionHeader title={t("screens.profile.settingsPage.about.title")} />
        <View style={styles.sectionGap}>
          <View style={styles.aboutContainer}>
            <ThemedText
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              {t("screens.profile.settingsPage.about.version")}
            </ThemedText>
            <ThemedText
              style={[
                typography.body,
                { color: colors.text, marginBottom: 12 },
              ]}
            >
              1.0.0
            </ThemedText>
          </View>
        </View>

        {__DEV__ && (
          <>
            <SectionHeader title={t("screens.profile.settingsPage.dev.title")} />
            <View style={styles.sectionGap}>
              <SettingItem
                title={t("screens.profile.settingsPage.dev.itemTitle")}
                description={t("screens.profile.settingsPage.dev.itemDescription")}
                onClick={() => router.push("/main/dev-settings")}
              />
            </View>
          </>
        )}

        {/* Sessão */}
        <SectionHeader
          title={t("screens.profile.settingsPage.session.title")}
        />
        <View style={styles.sessionContainer}>
          <Button
            label={t("screens.profile.settingsPage.session.logout")}
            onPress={handleLogout}
            variant="default"
            fullWidth
            size="lg"
          />

          <Button
            label={t("screens.profile.settingsPage.session.deleteAccount")}
            onPress={handleDeleteAccount}
            variant="destructive"
            size="lg"
            fullWidth
            style={styles.deleteAccountButton}
            textStyle={{ color: "#EF4444" }}
          />
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    ...typography.captionBold,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
  settingItem: {
    borderRadius: 16,
    padding: spacing.md,
  },
  settingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingBottom: spacing.xxl,
  },
  sectionGap: {
    gap: spacing.sm,
  },
  aboutContainer: {
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
  },
  sessionContainer: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  logoutButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  deleteAccountButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  invisibleToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  premiumBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 100,
  },
  premiumBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
