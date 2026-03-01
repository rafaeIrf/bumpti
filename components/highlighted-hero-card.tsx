import { FlameIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface HighlightedHeroCardProps {
  readonly title: string;
  readonly description?: string;
  readonly count?: number;
  readonly onPress: () => void;
}

function HighlightedHeroCardComponent({
  title,
  description,
  count,
  onPress,
}: HighlightedHeroCardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(150).springify()}
      style={[styles.wrapper, animStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
      >
        <LinearGradient
          colors={["#7C3AED", "#A855F7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Icon */}
          <View style={styles.iconCircle}>
            <FlameIcon width={22} height={22} color="#FFFFFF" />
          </View>

          {/* Text */}
          <View style={styles.textBlock}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
            {description ? (
              <View style={styles.descRow}>
                <ThemedText style={styles.description} numberOfLines={1}>
                  {description}
                </ThemedText>
                {count != null && count > 0 ? (
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>{count}</ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Chevron */}
          <View style={styles.chevron}>
            <ThemedText style={styles.chevronText}>›</ThemedText>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export const HighlightedHeroCard = React.memo(HighlightedHeroCardComponent);

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  descRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.captionBold,
    color: "#FFFFFF",
  },
  description: {
    ...typography.caption,
    color: "rgba(255,255,255,0.8)",
    flexShrink: 1,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  badgeText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontSize: 11,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chevronText: {
    ...typography.subheading,
    color: "#FFFFFF",
    marginTop: -2,
  },
});
