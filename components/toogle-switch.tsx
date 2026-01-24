import { useThemeColors } from "@/hooks/use-theme-colors";
import { Switch } from "react-native";

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
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.accent }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.border}
      disabled={disabled}
    />
  );
};

export default ToggleSwitch;
