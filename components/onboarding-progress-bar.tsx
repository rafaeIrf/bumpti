import { spacing } from "@/constants/theme";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useOnboardingProgress } from "./onboarding-progress-context";

interface OnboardingProgressBarProps {
  /**
   * Current step (1-based index)
   */
  currentStep: number;
  /**
   * Total number of steps
   */
  totalSteps: number;
}

export function OnboardingProgressBar({
  currentStep,
  totalSteps,
}: OnboardingProgressBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { progress, prevStepRef } = useOnboardingProgress();

  React.useEffect(() => {
    const percentage = Math.min(currentStep / totalSteps, 1);

    // Always animate
    progress.value = withSpring(percentage, {
      damping: 20,
      stiffness: 60,
      mass: 1,
    });

    prevStepRef.current = currentStep;
  }, [currentStep, totalSteps, progress, prevStepRef]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progress,
            { backgroundColor: colors.accent },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progress: {
    height: "100%",
    borderRadius: 2,
  },
});
