import { MapIcon } from "@/assets/icons";
import { spacing, typography } from "@/constants/theme";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ExploreCategoriesCardProps {
  onPress: () => void;
}

export function ExploreCategoriesCard({ onPress }: ExploreCategoriesCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={["#E8573D", "#D4206B"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        >
          <View style={styles.iconContainer}>
            <MapIcon width={28} height={28} color="#FFFFFF" />
          </View>
          <View style={styles.textContainer}>
            <ThemedText style={[typography.subheading, styles.title]}>
              {t("screens.home.explorePlaces.title")}
            </ThemedText>
            <ThemedText style={[typography.caption, styles.subtitle]}>
              {t("screens.home.explorePlaces.subtitle")}
            </ThemedText>
          </View>
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#E8573D",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    marginBottom: 2,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.85)",
  },
});
