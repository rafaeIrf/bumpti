import { IllustratedSlide } from "@/components/illustrated-slide";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing } from "@/constants/theme";
import { usePermissionSheet } from "@/hooks/use-permission-sheet";
import { useScreenTracking } from "@/modules/analytics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { router } from "expo-router";
import { useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * IntroCarousel - Design Dark com UnDraw Illustrations
 *
 * Senior UX Design: Modern, clean, professional
 * Apresenta 4 slides com ilustrações SVG do UnDraw
 */
export default function IntroCarouselScreen() {
  const colors = useThemeColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const { showTrackingSheet } = usePermissionSheet();

  // Track screen view
  useScreenTracking("onboarding_intro_carousel", {
    onboarding_step: 0,
    step_name: "intro_carousel",
  });

  // Slides minimalistas sem imagens
  const slides = [
    {
      id: "slide1",
      title: t("screens.onboarding.introCarousel.slide1.title"),
      text: t("screens.onboarding.introCarousel.slide1.text"),
    },
    {
      id: "slide2",
      title: t("screens.onboarding.introCarousel.slide2.title"),
      text: t("screens.onboarding.introCarousel.slide2.text"),
    },
    {
      id: "slide3",
      title: t("screens.onboarding.introCarousel.slide3.title"),
      text: t("screens.onboarding.introCarousel.slide3.text"),
    },
    {
      id: "slide4",
      title: t("screens.onboarding.introCarousel.slide4.title"),
      text: t("screens.onboarding.introCarousel.slide4.text"),
    },
  ];

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      // Navega para próximo slide
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollX.value = nextIndex * SCREEN_WIDTH;
    } else {
      router.replace("/(onboarding)/user-name");
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <IllustratedSlide title={item.title} text={item.text} index={index} />
  );

  return (
    <ThemedView style={styles.container}>
      <Carousel
        loop={false}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        data={slides}
        scrollAnimationDuration={400}
        onProgressChange={(_, absoluteProgress) => {
          scrollX.value = absoluteProgress * SCREEN_WIDTH;
          const newIndex = Math.round(absoluteProgress);
          if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
          }
        }}
        renderItem={renderItem}
      />

      {/* Pagination Dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <PaginationDot
            key={index}
            index={index}
            currentIndex={currentIndex}
            accentColor={colors.accent}
          />
        ))}
      </View>

      {/* Navigation Button - apenas no último slide */}
      {currentIndex === slides.length - 1 && (
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={[
            styles.buttonContainer,
            { bottom: insets.bottom + spacing.md },
          ]}
        >
          <Button
            label={t("screens.onboarding.introCarousel.finalButton")}
            onPress={handleNext}
            size="lg"
            fullWidth
          />
        </Animated.View>
      )}
    </ThemedView>
  );
}

// Componente separado para dots animados
function PaginationDot({
  index,
  currentIndex,
  accentColor,
}: {
  index: number;
  currentIndex: number;
  accentColor: string;
}) {
  const dotAnimStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];

    const width = interpolate(
      currentIndex,
      inputRange,
      [8, 24, 8],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      currentIndex,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    );

    return {
      width,
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        dotAnimStyle,
        {
          backgroundColor:
            index === currentIndex ? accentColor : "rgba(255, 255, 255, 0.3)",
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dotsContainer: {
    position: "absolute",
    bottom: spacing.xxl * 3,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
  },
});
