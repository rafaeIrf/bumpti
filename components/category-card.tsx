import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { getCardGradientColors } from "@/utils/card-gradient";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
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
import { BrandIcon } from "./ui/brand-icon";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CategoryCardProps {
  category: {
    id: string;
    icon?: React.ComponentType<{
      width: number;
      height: number;
      color: string;
    }>;
    title: string;
    description: string;
    iconColor: string;
    iconBgColor: string;
  };
  isSelected?: boolean;
  onClick: () => void;
  color?: string;
  illustration?: React.ComponentType<SvgProps>;
  useRawIllustration?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function CategoryCard({
  category,
  isSelected,
  onClick,
  color,
  illustration,
  useRawIllustration,
  style,
  textStyle,
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

    if (useRawIllustration) {
      return <Illustration width={80} height={80} />;
    }

    return (
      <BrandIcon
        icon={Illustration}
        size="md"
        color="#FFFFFF"
        style={{
          backgroundColor: "rgba(255,255,255,0.2)",
          borderWidth: 0,
        }}
      />
    );
  };

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.pressable, animatedStyle, style]}
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
          <LinearGradient
            colors={getCardGradientColors(resolvedColor)}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
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
            <ThemedText
              style={[typography.body1, styles.title, textStyle]}
              numberOfLines={2}
            >
              {category.title}
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    height: 140,
  },
  container: {
    borderRadius: 24,
    overflow: "hidden",
    width: "100%",
    flex: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardBackground: {
    borderRadius: 20,
    overflow: "hidden",
    flex: 1,
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
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
