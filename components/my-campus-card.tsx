import { UniversityIcon } from "@/assets/illustrations";
import { LoadingView } from "@/components/loading-view";
import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography } from "@/constants/theme";
import { usePlaceClick } from "@/hooks/use-place-click";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import type { ProfileData } from "@/modules/store/slices/profileSlice";
import { getCardGradientColors } from "@/utils/card-gradient";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface MyCampusCardProps {
  profile: ProfileData;
}

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
    university_regulars_count,
    university_presence_avatars,
    show_university_on_home,
  } = profile;

  const hasUniversity = !!university_id || !!university_name_custom;
  const shouldShow = show_university_on_home && hasUniversity;
  const displayName = university_name || university_name_custom || "";
  const isOfficialUniversity = !!university_id;
  const activeCount = university_active_users ?? 0;
  const regularsCount = university_regulars_count ?? 0;
  const presenceAvatars = university_presence_avatars ?? [];
  const totalPeopleCount = activeCount + regularsCount;
  const hasActiveUsers = isOfficialUniversity && totalPeopleCount > 0;

  console.log("activeCount", activeCount);
  console.log("regularsCount", regularsCount);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    if (!hasActiveUsers) return;
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveUsers]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  const handlePress = useCallback(async () => {
    if (!university_id || !university_lat || !university_lng) return;
    try {
      setIsLoading(true);
      await handlePlaceClick({
        placeId: university_id,
        name: displayName,
        latitude: university_lat,
        longitude: university_lng,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    university_id,
    university_lat,
    university_lng,
    displayName,
    handlePlaceClick,
  ]);

  if (!shouldShow) return null;

  const statusText = hasActiveUsers
    ? t("screens.home.myCampus.activeNow", { count: university_active_users })
    : isOfficialUniversity
      ? t("screens.home.myCampus.tapToConnect")
      : t("screens.home.myCampus.findOnMap");

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, cardStyle]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          if (isOfficialUniversity) scale.value = withSpring(0.98);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        disabled={!isOfficialUniversity || isLoading}
      >
        <LinearGradient
          colors={getCardGradientColors(colors.pastelBlue)}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.row}
        >
          {/* Left: icon */}
          <View style={styles.iconCircle}>
            {isLoading ? (
              <LoadingView
                style={{ backgroundColor: "transparent" }}
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <UniversityIcon width={24} height={24} />
            )}
          </View>

          {/* Center: status + name */}
          <View style={styles.content}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {displayName.toUpperCase()}
            </ThemedText>
            {presenceAvatars.length > 0 ? (
              <StackedAvatars
                style={{ marginTop: spacing.xs }}
                avatarStyle={{ borderColor: colors.white, borderWidth: 0.5 }}
                avatars={presenceAvatars}
                size={24}
                totalCount={totalPeopleCount}
                maxVisible={4}
              />
            ) : (
              <View style={styles.statusRow}>
                {hasActiveUsers && (
                  <Animated.View style={[styles.liveDot, dotStyle]} />
                )}
                <ThemedText style={styles.statusText} numberOfLines={1}>
                  {statusText}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Right: chevron */}
          {isOfficialUniversity && (
            <IconSymbol
              name="chevron.right"
              size={16}
              color="rgba(255,255,255,0.5)"
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
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64FF96",
  },
  statusText: {
    ...typography.caption,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  name: {
    ...typography.captionBold,
  },
});
