import { StyleSheet, View } from "react-native";

interface PlanRadioButtonProps {
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly accentColor: string;
}

export function PlanRadioButton({
  isSelected,
  isHighlighted,
  accentColor,
  isLocked = false,
}: PlanRadioButtonProps & { isLocked?: boolean }) {
  const getBorderColor = () => {
    if (isSelected) {
      return isHighlighted ? "#FFFFFF" : accentColor;
    }
    return isHighlighted ? "rgba(255, 255, 255, 0.5)" : "#4A4A4A";
  };

  return (
    <View
      style={[
        styles.radioOuter,
        {
          borderColor: getBorderColor(),
        },
      ]}
    >
      {isSelected && (
        <View
          style={[
            styles.radioInner,
            {
              backgroundColor: isHighlighted ? "#FFFFFF" : accentColor,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
