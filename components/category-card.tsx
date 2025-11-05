import { ArrowRightIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CategoryCardProps {
  category: {
    id: string;
    icon: React.ComponentType<{ width: number; height: number; color: string }>;
    title: string;
    description: string;
    gradient: [string, string];
    categoryIcon: string;
  };
  isSelected?: boolean;
  onClick: () => void;
}

export function CategoryCard({
  category,
  isSelected,
  onClick,
}: CategoryCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

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

  const Icon = category.icon;

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle]}
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
        <LinearGradient
          colors={["#141414", "#1E1E1E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          {/* Gradient Overlay on Press */}
          <Animated.View style={[styles.hoverOverlay, overlayStyle]}>
            <LinearGradient
              colors={["rgba(41, 151, 255, 0.05)", "rgba(41, 151, 255, 0.1)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {isSelected && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: `${colors.accent}20`,
                  borderRadius: 16,
                },
              ]}
            />
          )}

          <View style={styles.content}>
            {/* Icon with gradient background */}
            <LinearGradient
              colors={category.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconContainer}
            >
              <Icon width={40} height={40} color="#FFFFFF" />
            </LinearGradient>

            {/* Content */}
            <View style={styles.textContainer}>
              <View style={styles.textContent}>
                <View style={styles.titleRow}>
                  <View style={styles.titleWrapper}>
                    <ThemedText
                      style={[styles.title, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {category.title}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.description,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {category.description}
                    </ThemedText>
                  </View>

                  {/* Arrow icon */}
                  <View style={styles.arrowContainer}>
                    <ArrowRightIcon
                      width={20}
                      height={20}
                      color={colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ThemedView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
  },
  gradientBackground: {
    borderRadius: 16,
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  content: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    zIndex: 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 8,
  },
  textContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  titleWrapper: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
