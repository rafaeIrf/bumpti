import { UniversityIcon } from "@/assets/illustrations";
import { LoadingView } from "@/components/loading-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography } from "@/constants/theme";
import { usePlaceClick } from "@/hooks/use-place-click";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import type { ProfileData } from "@/modules/store/slices/profileSlice";
import { getCardGradientColors } from "@/utils/card-gradient";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface MyCampusCardProps {
  profile: ProfileData;
}

/**
 * MyCampusCard - Shows user's university on the home screen
 *
 * Uses university data from the profile (which includes joined places data).
 * No extra API call needed - the get-profile already fetches university info.
 */
function MyCampusCardComponent({ profile }: MyCampusCardProps) {
  const colors = useThemeColors();
  const { handlePlaceClick } = usePlaceClick();
  const [isLoading, setIsLoading] = useState(false);

  const {
    university_id,
    university_name,
    university_name_custom,
    university_lat,
    university_lng,
    university_active_users,
    show_university_on_home,
  } = profile;

  // Check if we should display the card
  const hasUniversity = !!university_id || !!university_name_custom;
  const shouldShow = show_university_on_home && hasUniversity;

  // Display name: prefer joined name from places, fall back to custom name
  const displayName = university_name || university_name_custom || "";

  // Determine if this is an official or custom university
  const isOfficialUniversity = !!university_id;

  // Handle card press using usePlaceClick hook
  const handlePress = useCallback(async () => {
    if (university_id && university_lat && university_lng) {
      try {
        setIsLoading(true);
        await handlePlaceClick({
          placeId: university_id,
          name: displayName,
          latitude: university_lat,
          longitude: university_lng,
        });
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    }
    // For custom university, card is informational only
  }, [
    university_id,
    university_lat,
    university_lng,
    displayName,
    handlePlaceClick,
  ]);

  // Don't render if conditions not met
  if (!shouldShow) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <Pressable
        onPress={handlePress}
        disabled={!isOfficialUniversity || isLoading}
        style={({ pressed }) => [
          styles.card,
          {
            opacity: pressed && isOfficialUniversity ? 0.9 : 1,
            transform: [{ scale: pressed && isOfficialUniversity ? 0.98 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={getCardGradientColors(colors.pastelBlue)}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientInner}
        >
          {/* Left Section: Icon or Loading */}
          <View style={styles.iconContainer}>
            {isLoading ? (
              <LoadingView
                style={{ backgroundColor: "transparent" }}
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <UniversityIcon width={28} height={28} />
            )}
          </View>

          {/* Middle Section: Content */}
          <View style={styles.contentContainer}>
            {/* Title */}
            <ThemedText
              style={[styles.title, { color: "#FFFFFF" }]}
              numberOfLines={1}
            >
              {displayName}
            </ThemedText>

            {/* Subtitle */}
            <ThemedText style={[styles.subtitle, { color: "#FFFFFF" }]}>
              {isOfficialUniversity && university_active_users! > 0
                ? t("screens.home.myCampus.activeNow", {
                    count: university_active_users,
                  })
                : isOfficialUniversity
                  ? t("screens.home.myCampus.tapToConnect")
                  : t("screens.home.myCampus.findOnMap")}
            </ThemedText>
          </View>

          {/* Right Section: Chevron */}
          {isOfficialUniversity && (
            <IconSymbol
              name="chevron.right"
              size={20}
              color="rgba(255, 255, 255, 0.6)"
            />
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export const MyCampusCard = memo(MyCampusCardComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gradientInner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  title: {
    ...typography.body,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
    fontWeight: "500",
  },
});
