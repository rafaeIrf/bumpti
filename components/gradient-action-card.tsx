import { ChevronRightIcon } from "@/assets/icons";
import { spacing, typography } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SvgProps } from "react-native-svg";
import { ThemedText } from "./themed-text";

export interface GradientActionCardProps {
  /** Title text displayed prominently */
  readonly title: string;
  /** Subtitle / description below the title */
  readonly subtitle?: string;
  /** Gradient colors (2 or 3 stops) */
  readonly gradientColors: readonly string[];
  /** Gradient stop locations (for 3-stop gradients) */
  readonly gradientLocations?: readonly number[];
  /** Icon component rendered inside the circular container */
  readonly icon: React.ComponentType<SvgProps>;
  /** Size of the icon (width & height). Default 28 */
  readonly iconSize?: number;
  /** Replace icon with custom content (e.g. loading spinner) */
  readonly iconOverride?: React.ReactNode;
  /** Show a numeric badge next to subtitle */
  readonly badgeCount?: number;
  /** Show a chevron arrow on the right */
  readonly showChevron?: boolean;
  /** Shadow color matching gradient. Default first gradient color */
  readonly shadowColor?: string;
  /** Custom content rendered below the title (e.g. avatars) */
  readonly children?: React.ReactNode;
  /** Whether to disable the press handler */
  readonly disabled?: boolean;
  /** Custom style applied to the outer wrapper */
  readonly style?: ViewStyle;
  /** Press handler */
  readonly onPress: () => void;
}

function GradientActionCardInner({
  title,
  subtitle,
  gradientColors,
  gradientLocations,
  icon: IconComponent,
  iconSize = 28,
  iconOverride,
  badgeCount,
  showChevron = false,
  shadowColor,
  children,
  disabled,
  style: customStyle,
  onPress,
}: GradientActionCardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(150).springify()}
      style={[
        styles.wrapper,
        animStyle,
        { shadowColor: shadowColor ?? (gradientColors[0] as string) },
        customStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        disabled={disabled}
      >
        <LinearGradient
          colors={
            [...(gradientColors as string[])] as [string, string, ...string[]]
          }
          locations={
            gradientLocations
              ? ([...(gradientLocations as number[])] as [
                  number,
                  number,
                  ...number[],
                ])
              : undefined
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        >
          {/* Icon */}
          <View style={styles.iconCircle}>
            {iconOverride ?? (
              <IconComponent
                width={iconSize}
                height={iconSize}
                color="#FFFFFF"
              />
            )}
          </View>

          {/* Text */}
          <View style={styles.textBlock}>
            <ThemedText
              style={[typography.subheading, styles.title]}
              numberOfLines={1}
            >
              {title}
            </ThemedText>
            {subtitle ? (
              <View style={styles.descRow}>
                <ThemedText
                  style={[typography.caption, styles.subtitle]}
                  numberOfLines={1}
                >
                  {subtitle}
                </ThemedText>
                {badgeCount != null && badgeCount > 0 ? (
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>
                      {badgeCount}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}
            {children}
          </View>

          {/* Chevron */}
          {showChevron && (
            <ChevronRightIcon width={24} height={24} color="#FFFFFF" />
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export const GradientActionCard = React.memo(GradientActionCardInner);

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: spacing.lg,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    height: 96,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  descRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    color: "#FFFFFF",
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    flexShrink: 1,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 6,
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
