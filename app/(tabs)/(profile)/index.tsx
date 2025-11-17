import {
  CheckIcon,
  CrownIcon,
  FlameIcon,
  MapPinIcon,
  NavigationIcon,
  SettingsIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useAppSelector } from "@/modules/store/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface BenefitRow {
  labelKey: string;
  free: boolean;
  premium: boolean;
}

const BENEFITS: BenefitRow[] = [
  {
    labelKey: "screens.profile.benefits.unlimitedLikes",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.seeWhoLiked",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.priorityLikes",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.unlimitedRewind",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.visibilityControl",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.seeWhoViewedYou",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.turboWeekly",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.earlyCheckinWeekly",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.pingsWeekly",
    free: false,
    premium: true,
  },
];

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { userData } = useAppSelector((state) => state.onboarding);

  const handleSettingsClick = () => {
    // TODO: Navigate to settings
    console.log("Settings clicked");
  };

  const handleCompleteProfile = () => {
    // TODO: Navigate to profile completion
    console.log("Complete profile clicked");
  };

  const handleTurboClick = () => {
    // TODO: Show Turbo paywall modal
    console.log("Turbo+ clicked");
  };

  const handlePingsClick = () => {
    // TODO: Show Pings paywall modal
    console.log("Pings clicked");
  };

  const handleEarlyCheckinClick = () => {
    // TODO: Show Early Checkin paywall modal
    console.log("Early Checkin clicked");
  };

  const handlePremiumClick = () => {
    router.push("/premium-paywall");
  };

  const profilePhoto = userData.photoUris?.[0];

  return (
    <BaseTemplateScreen>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings Button */}
        <View style={styles.toolbar}>
          <Pressable
            onPress={handleSettingsClick}
            style={({ pressed }) => [
              styles.settingsButton,
              {
                backgroundColor: pressed ? colors.surface : "transparent",
              },
            ]}
          >
            <SettingsIcon width={20} height={20} color={colors.accent} />
          </Pressable>
        </View>

        <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
          {/* Profile Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.profileHeader}
          >
            {/* Profile Photo */}
            <View style={styles.photoContainer}>
              <View style={[styles.photoRing, { borderColor: colors.accent }]}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.photo} />
                ) : (
                  <View
                    style={[
                      styles.photoPlaceholder,
                      { backgroundColor: colors.surface },
                    ]}
                  />
                )}
              </View>
            </View>

            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <ThemedText
                style={[typography.subheading, { color: colors.text }]}
              >
                {userData.name || t("screens.profile.title")}
                {userData.age
                  ? `, ${t("screens.profile.yearsOld", { age: userData.age })}`
                  : ""}
              </ThemedText>

              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t("screens.profile.premium.subtitle")}
              </ThemedText>

              <Pressable
                onPress={handleCompleteProfile}
                style={({ pressed }) => [
                  styles.profileButton,
                  {
                    backgroundColor: pressed ? "#1D7FD9" : colors.accent,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    typography.body,
                    { fontWeight: "600", color: "#FFFFFF" },
                  ]}
                >
                  {t("screens.profile.completeProfile")}
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>

          {/* Action Cards */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.actionCardsContainer}
          >
            {/* Turbo+ Card */}
            <Pressable onPress={handleTurboClick} style={styles.actionCard}>
              <LinearGradient
                colors={["#1C1C1C", "#0F0F0F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCardGradient}
              >
                <View
                  style={[
                    styles.actionCardIcon,
                    { backgroundColor: "rgba(41, 151, 255, 0.15)" },
                  ]}
                >
                  <FlameIcon width={20} height={20} color={colors.accent} />
                </View>
                <ThemedText
                  style={[typography.caption, { color: colors.text }]}
                >
                  {t("screens.profile.turbo.title")}
                </ThemedText>
              </LinearGradient>
            </Pressable>

            {/* Pings Card */}
            <Pressable onPress={handlePingsClick} style={styles.actionCard}>
              <LinearGradient
                colors={["#1C1C1C", "#0F0F0F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCardGradient}
              >
                <View
                  style={[
                    styles.actionCardIcon,
                    { backgroundColor: "rgba(41, 151, 255, 0.15)" },
                  ]}
                >
                  <NavigationIcon
                    width={20}
                    height={20}
                    color={colors.accent}
                  />
                </View>
                <ThemedText
                  style={[typography.caption, { color: colors.text }]}
                >
                  {t("screens.profile.pings.title")}
                </ThemedText>
              </LinearGradient>
            </Pressable>

            {/* Early Checkin Card */}
            <Pressable
              onPress={handleEarlyCheckinClick}
              style={styles.actionCard}
            >
              <LinearGradient
                colors={["#1C1C1C", "#0F0F0F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCardGradient}
              >
                <View
                  style={[
                    styles.actionCardIcon,
                    { backgroundColor: "rgba(41, 151, 255, 0.15)" },
                  ]}
                >
                  <MapPinIcon width={20} height={20} color={colors.accent} />
                </View>
                <ThemedText
                  style={[typography.caption, { color: colors.text }]}
                >
                  {t("screens.profile.earlyCheckin.title")}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Premium Hero Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Pressable onPress={handlePremiumClick}>
              <LinearGradient
                colors={["#2997FF", "#0A0A0A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumCard}
              >
                <View
                  style={[
                    styles.premiumIconContainer,
                    { backgroundColor: "rgba(255, 255, 255, 0.15)" },
                  ]}
                >
                  <CrownIcon width={24} height={24} color="#FFFFFF" />
                </View>

                <ThemedText style={[typography.heading, { color: "#FFFFFF" }]}>
                  {t("screens.profile.premium.title")}
                </ThemedText>

                <ThemedText
                  style={[
                    typography.body,
                    { color: "rgba(255, 255, 255, 0.8)" },
                  ]}
                >
                  {t("screens.profile.premium.description")}
                </ThemedText>

                <View style={styles.premiumButton}>
                  <ThemedText
                    style={[
                      typography.body,
                      { fontWeight: "600", color: "#FFFFFF" },
                    ]}
                  >
                    {t("screens.profile.premium.cta")}
                  </ThemedText>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Benefits Table */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <LinearGradient
              colors={["#1C1C1C", "#0F0F0F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.benefitsCard}
            >
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.profile.benefits.title")}
              </ThemedText>

              {/* Table Header */}
              <View
                style={[
                  styles.tableHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.tableHeaderCell} />
                <ThemedText
                  style={[
                    typography.caption,
                    {
                      color: colors.textSecondary,
                      flex: 1,
                      textAlign: "center",
                    },
                  ]}
                >
                  {t("screens.profile.benefits.free")}
                </ThemedText>
                <ThemedText
                  style={[
                    typography.caption,
                    { color: colors.accent, flex: 1, textAlign: "center" },
                  ]}
                >
                  {t("screens.profile.benefits.premium")}
                </ThemedText>
              </View>

              {/* Table Rows */}
              <View style={styles.tableBody}>
                {BENEFITS.map((benefit) => (
                  <View key={benefit.labelKey} style={styles.tableRow}>
                    <ThemedText
                      style={[
                        typography.caption,
                        { color: colors.text, flex: 2 },
                      ]}
                    >
                      {t(benefit.labelKey)}
                    </ThemedText>
                    <View style={styles.tableCell}>
                      {benefit.free ? (
                        <CheckIcon
                          width={16}
                          height={16}
                          color={colors.accent}
                        />
                      ) : (
                        <View style={styles.iconPlaceholder}>
                          <ThemedText
                            style={[
                              typography.body,
                              { color: colors.textSecondary },
                            ]}
                          >
                            —
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.tableCell}>
                      {benefit.premium ? (
                        <CheckIcon
                          width={16}
                          height={16}
                          color={colors.accent}
                        />
                      ) : (
                        <View style={styles.iconPlaceholder}>
                          <ThemedText
                            style={[
                              typography.body,
                              { color: colors.textSecondary },
                            ]}
                          >
                            —
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </ScrollView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  photoContainer: {
    flexShrink: 0,
  },
  photoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    padding: 0,
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 37.5,
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 37.5,
  },
  profileInfo: {
    flex: 1,
  },
  profileButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    alignSelf: "flex-start",
    shadowColor: "#2997FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionCardsContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    height: 90,
  },
  actionCardGradient: {
    flex: 1,
    borderRadius: 14,
    padding: spacing.md,
    shadowColor: "#2997FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(41, 151, 255, 0.2)",
    justifyContent: "space-between",
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumCard: {
    borderRadius: 16,
    padding: spacing.lg,
    minHeight: 140,
  },
  premiumIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  premiumButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: "#000000",
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  benefitsCard: {
    borderRadius: 16,
    padding: spacing.lg,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  tableHeaderCell: {
    flex: 2,
  },
  tableBody: {
    gap: spacing.xs,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  tableCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPlaceholder: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
