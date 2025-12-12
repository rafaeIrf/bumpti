import { ArrowRightIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

interface PotentialConnectionsBannerProps {
  count: number;
  profilePhotos: string[];
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function PotentialConnectionsBanner({
  count,
  profilePhotos,
  onPress,
  style,
}: PotentialConnectionsBannerProps) {
  const colors = useThemeColors();
  const animatedValues = useRef(
    profilePhotos.slice(0, 3).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = animatedValues.map((animValue, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: -8,
            duration: 1500,
            delay: index * 300,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      )
    );

    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [animatedValues]);

  return (
    <Pressable onPress={onPress} style={style}>
      <ThemedView style={[styles.banner, { backgroundColor: colors.surface }]}>
        {/* Left: Floating photo stack */}
        <View style={styles.photoStack}>
          {profilePhotos.slice(0, 3).map((photo, index) => (
            <Animated.Image
              key={index}
              source={{ uri: photo }}
              style={[
                styles.photo,
                {
                  top: index * 8,
                  zIndex: 3 - index,
                  transform: [{ translateY: animatedValues[index] }],
                },
              ]}
              blurRadius={4}
            />
          ))}
        </View>

        {/* Middle: Text content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>
              {t("screens.chat.potentialConnections.title")}
            </ThemedText>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>+{count}</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.subtitle}>
            {t("screens.chat.potentialConnections.cta")}
          </ThemedText>
        </View>

        {/* Right: Arrow icon */}
        <View style={styles.arrowContainer}>
          <ArrowRightIcon width={24} height={24} color={colors.white} />
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    gap: spacing.md,
  },
  photoStack: {
    width: 48,
    height: 48,
    position: "relative",
    flexShrink: 0,
  },
  photo: {
    position: "absolute",
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 21,
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    flexShrink: 0,
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 12,
  },
  subtitle: {
    color: "#E6E6E6",
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 13,
  },
  arrowContainer: {
    flexShrink: 0,
    alignSelf: "flex-start",
  },
});
