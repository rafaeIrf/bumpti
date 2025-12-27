import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SvgProps } from "react-native-svg";
import { ThemedText } from "./themed-text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CategoryCardProps {
  category: {
    id: string;
    icon: React.ComponentType<{ width: number; height: number; color: string }>;
    title: string;
    description: string;
    iconColor: string;
    iconBgColor: string;
  };
  isSelected?: boolean;
  onClick: () => void;
  color?: string;
  illustration?: React.ComponentType<SvgProps>;
  style?: StyleProp<ViewStyle>;
}

export function CategoryCard({
  category,
  isSelected,
  onClick,
  color,
  illustration,
  style,
}: CategoryCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const resolvedColor = color ?? category.iconBgColor ?? colors.surface;
  const overlayColor = "rgba(13, 13, 13, 0.2)";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    opacity.value = withSpring(1);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withSpring(0);
  };

  const renderIllustration = () => {
    if (!illustration) return null;

    const Illustration = illustration as React.ComponentType<SvgProps>;
    return <Illustration width={100} height={100} />;
  };

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      <ThemedView
        style={[
          styles.container,
          {
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.cardBackground}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: resolvedColor },
            ]}
          />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]}
          />
          {isSelected && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: `${colors.accent}25`,
                },
              ]}
            />
          )}
          <Animated.View
            pointerEvents="none"
            style={[styles.hoverOverlay, overlayStyle]}
          />
          <View style={styles.content}>
            {illustration && (
              <View style={styles.illustrationContainer}>
                {renderIllustration()}
              </View>
            )}
            <View style={styles.infoRow}>
              <View style={styles.iconAndText}>
                <ThemedText
                  style={[typography.body1, styles.title, { color: "#FFFFFF" }]}
                >
                  {category.title}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </ThemedView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: "hidden",
    width: "100%",
    minHeight: 220,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardBackground: {
    borderRadius: 24,
    overflow: "hidden",
    minHeight: 220,
    position: "relative",
  },
  hoverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  content: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    justifyContent: "space-between",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  iconAndText: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  arrowContainer: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  illustrationImage: {
    width: "70%",
    height: "70%",
  },
  peopleBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  peopleBadgeText: {
    color: "#FFFFFF",
  },
});
