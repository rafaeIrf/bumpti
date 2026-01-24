import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ThemedText } from "./themed-text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface IllustratedSlideProps {
  title: string;
  text: string;
  index: number;
}

/**
 * Slide minimalista sem imagens
 * Design clean: cores + tipografia + geometria simples
 */
export function IllustratedSlide({
  title,
  text,
  index,
}: IllustratedSlideProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Decorações geométricas */}
      <Animated.View
        entering={FadeIn.delay(index * 100).duration(800)}
        style={[styles.circle1, { backgroundColor: colors.accentBlueLight }]}
      />
      <Animated.View
        entering={FadeIn.delay(index * 100 + 200).duration(800)}
        style={[styles.circle2, { backgroundColor: colors.accentBlueLight }]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Accent Bar */}
        <Animated.View
          entering={FadeInDown.delay(index * 100).duration(600)}
          style={[styles.accentBar, { backgroundColor: colors.accent }]}
        />

        {/* Título */}
        <Animated.View
          entering={FadeInDown.delay(index * 100 + 150).duration(600)}
        >
          <ThemedText
            style={[
              typography.heading1,
              {
                textAlign: "center",
                marginBottom: spacing.lg,
              },
            ]}
          >
            {title}
          </ThemedText>
        </Animated.View>

        {/* Texto */}
        <Animated.View
          entering={FadeInDown.delay(index * 100 + 300).duration(600)}
        >
          <ThemedText
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 26,
                fontSize: 17,
                paddingHorizontal: spacing.xl,
              },
            ]}
          >
            {text}
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    paddingBottom: SCREEN_HEIGHT * 0.15,
  },
  accentBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.xxl,
  },
  circle1: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: (SCREEN_WIDTH * 1.2) / 2,
    top: -SCREEN_WIDTH * 0.5,
    right: -SCREEN_WIDTH * 0.3,
  },
  circle2: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: (SCREEN_WIDTH * 0.8) / 2,
    bottom: -SCREEN_WIDTH * 0.2,
    left: -SCREEN_WIDTH * 0.2,
  },
});
