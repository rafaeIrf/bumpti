import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import type { OnValueChangeEventPayload } from "@/modules/range-slider/src/RangeSlider.types";
import RangeSliderView from "@/modules/range-slider/src/RangeSliderView";
import { StyleSheet, View } from "react-native";

interface AgeRangeSliderProps {
  readonly min: number;
  readonly max: number;
  readonly value: [number, number];
  readonly onValueChange: (value: [number, number]) => void;
  readonly onSlidingComplete?: (value: [number, number]) => void;
}

export function AgeRangeSlider({
  min,
  max,
  value,
  onValueChange,
  onSlidingComplete,
}: AgeRangeSliderProps) {
  const colors = useThemeColors();

  const rangeText =
    value[1] >= 80
      ? t("filters.age.rangeMax", { min: value[0], max: value[1] })
      : t("filters.age.range", { min: value[0], max: value[1] });

  const handleValueChange = (event: {
    nativeEvent: OnValueChangeEventPayload;
  }) => {
    const { minValue, maxValue } = event.nativeEvent;
    onValueChange([minValue, maxValue]);
  };

  const handleSlidingComplete = (event: {
    nativeEvent: OnValueChangeEventPayload;
  }) => {
    const { minValue, maxValue } = event.nativeEvent;
    onSlidingComplete?.([minValue, maxValue]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <ThemedText style={[styles.value, { color: colors.text }]}>
          {rangeText}
        </ThemedText>
      </View>

      <RangeSliderView
        minValue={min}
        maxValue={max}
        lowerValue={value[0]}
        upperValue={value[1]}
        accentColor={colors.accent}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        style={styles.slider}
      />

      {/* Range visual indicator */}
      <View style={styles.rangeLabels}>
        <ThemedText
          style={[styles.rangeLabel, { color: colors.textSecondary }]}
        >
          {min}
        </ThemedText>
        <ThemedText
          style={[styles.rangeLabel, { color: colors.textSecondary }]}
        >
          {max}+
        </ThemedText>
      </View>

      <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
        {t("filters.age.hint")}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: spacing.sm,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
  },
  slider: {
    width: "100%",
    height: 60,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    marginTop: spacing.sm,
  },
  rangeLabel: {
    fontSize: 12,
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
