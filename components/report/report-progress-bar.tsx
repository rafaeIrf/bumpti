import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleSheet, View } from "react-native";

interface ReportProgressBarProps {
  currentStep: 1 | 2;
  totalSteps?: number;
}

export function ReportProgressBar({
  currentStep,
  totalSteps = 2,
}: ReportProgressBarProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.progressBarContainer}>
      <View
        style={[
          styles.progressBarSegment,
          {
            backgroundColor: colors.accent,
            borderTopLeftRadius: 4,
            borderBottomLeftRadius: 4,
          },
        ]}
      />
      <View
        style={[
          styles.progressBarSegment,
          {
            backgroundColor: currentStep === 2 ? colors.accent : colors.border,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  progressBarContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    height: 4,
  },
  progressBarSegment: {
    flex: 1,
    height: "100%",
  },
});
