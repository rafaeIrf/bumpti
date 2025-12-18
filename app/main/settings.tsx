import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
  ListIcon,
  LockIcon,
  MessageCircleIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import ToggleSwitch from "@/components/toogle-switch";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { phoneAuthService } from "@/modules/auth/phone-auth-service";
import { t } from "@/modules/locales";
import { openEmail, openPrivacyPolicy, openTermsOfUse } from "@/utils/linking";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SvgProps } from "react-native-svg";

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

interface SettingItemProps {
  icon: React.FC<SvgProps>;
  title: string;
  description?: string;
  rightContent?: React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
}

function SettingItem({
  icon: Icon,
  title,
  description,
  rightContent,
  onClick,
  showChevron = true,
}: SettingItemProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onClick}
      style={({ pressed }) => [
        styles.settingItem,
        {
          backgroundColor: (colors as any).surfaceHover
            ? "rgba(255, 255, 255, 0.04)"
            : colors.surface,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.settingItemContent}>
        <View style={styles.iconContainer}>
          <Icon width={20} height={20} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={[typography.body, { color: colors.text }]}>
            {title}
          </ThemedText>
          {description && (
            <ThemedText
              style={[
                typography.caption,
                { color: "rgba(255, 255, 255, 0.5)", marginTop: 2 },
              ]}
            >
              {description}
            </ThemedText>
          )}
        </View>
        {rightContent ? (
          <View>{rightContent}</View>
        ) : showChevron ? (
          <ArrowRightIcon
            width={20}
            height={20}
            color="rgba(255, 255, 255, 0.3)"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [invisibleMode, setInvisibleMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleClose = () => {
    router.back();
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
              router.replace("/(onboarding)/welcome");
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
              router.replace("/(onboarding)/welcome");
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
            icon={UserRoundIcon}
            title={t("screens.profile.settingsPage.presence.invisible")}
            description={t(
              "screens.profile.settingsPage.presence.invisibleDescription"
            )}
            rightContent={
              <ToggleSwitch
                value={invisibleMode}
                onValueChange={setInvisibleMode}
                colors={colors}
              />
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
            icon={MessageCircleIcon}
            title={t("screens.profile.settingsPage.notifications.push")}
            rightContent={
              <ToggleSwitch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                colors={colors}
              />
            }
            showChevron={false}
          />
        </View>

        {/* Conta */}
        <SectionHeader
          title={t("screens.profile.settingsPage.account.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            icon={LockIcon}
            title={t("screens.profile.settingsPage.account.blockList")}
            description={t(
              "screens.profile.settingsPage.account.blockListDescription"
            )}
            onClick={() => router.push("/main/blocked-list")}
          />
          <SettingItem
            icon={ShieldCheckIcon}
            title={t("screens.profile.settingsPage.account.verifyProfile")}
            onClick={() => logger.log("Verify profile clicked")}
          />
        </View>

        {/* Segurança e Privacidade */}
        <SectionHeader
          title={t("screens.profile.settingsPage.security.title")}
        />
        <View style={styles.sectionGap}>
          <SettingItem
            icon={ListIcon}
            title={t("screens.profile.settingsPage.security.privacyPolicy")}
            onClick={openPrivacyPolicy}
          />
          <SettingItem
            icon={ListIcon}
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
            icon={ExclamationCircleIcon}
            title={t("screens.profile.settingsPage.support.help")}
            onClick={() => openEmail(undefined, "Help & Support")}
          />
          <SettingItem
            icon={ShieldAlertIcon}
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
            <ThemedText
              style={[
                typography.caption,
                { color: "rgba(255, 255, 255, 0.6)" },
              ]}
            >
              {t("screens.profile.settingsPage.about.madeWith")}
            </ThemedText>
          </View>
        </View>

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
});
