import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Pressable, StyleSheet, View } from "react-native";
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
}

export function CategoryCard({
  category,
  isSelected,
  onClick,
  color,
  illustration,
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

export const CARD_COLORS = {
  flameOrange: "#FF6A3D",
  sunsetCoral: "#FF7E57",
  hotPeach: "#FF8A65",
  bloodOrange: "#FF5733",
  goldenPunch: "#FFB84D",
  heatBurst: "#FF934F",
  electricBlue: "#3DA9FF",
  cyberBlue: "#4CC2FF",
  azurePop: "#6AC5FF",
  skyPulse: "#78D6FF",
  sapphireNeon: "#2F8BFF",
  iceBlue: "#A2DFFF",
  neonMint: "#6BFFBA",
  aquaLeaf: "#76F7C5",
  digitalGreen: "#48FF9B",
  iceMint: "#90FFCD",
  vitalGreen: "#32E68A",
  limeFlash: "#C1FF72",
  neonPink: "#FF6DA8",
  rosePulse: "#FF7BB9",
  candyMagenta: "#FF4FA7",
  orchidGlow: "#C87BFF",
  lavenderPop: "#A38BFF",
  ultraViolet: "#8E5CFF",
  apricotPastel: "#FFB08C",
  softCoral: "#FF9970",
  lightOrchid: "#D6A8FF",
  aquaPastel: "#8CFFE1",
  peachSorbet: "#FFC7A9",
  lilacMist: "#C5B2FF",
  neoTurquoise: "#00F7FF",
  plasmaPurple: "#AA66FF",
  cyberLemon: "#EFFF57",
  vaporPink: "#FF4FA3",
  neonJade: "#4AFFC7",
  hyperBlue: "#009DFF",
  midnightPurple: "#433DFF",
  deepMagenta: "#B54CFF",
  navyGlow: "#2237FF",
  darkCoral: "#CC5E59",
  twilightRose: "#FF85A6",
  moonlightTeal: "#00C9A7",
  red: "#f97286ff",
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: "hidden",
    width: "100%",
    minHeight: 250,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardBackground: {
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 250,
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
