import { useThemeColors } from "@/hooks/use-theme-colors";
import { StyleSheet, Switch } from "react-native";
import { useAnimatedStyle, withSpring } from "react-native-reanimated";

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  colors: ReturnType<typeof useThemeColors>;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onValueChange,
  colors,
  disabled = false,
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(value ? 24 : 0) }],
  }));

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.accent }}
      thumbColor={colors.text}
      disabled={disabled}
    />
  );
};

export default ToggleSwitch;

const styles = StyleSheet.create({
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 4,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
});
