import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { ComponentType } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

export type BrandIconSize = "sm" | "md" | "lg";

export interface BrandIconProps {
  icon: ComponentType<SvgProps>;
  size?: BrandIconSize;
  color?: string;
  style?: ViewStyle;
}

const sizeMap = {
  sm: { container: 40, icon: 20 },
  md: { container: 56, icon: 28 },
  lg: { container: 72, icon: 32 },
};

export function BrandIcon({
  icon: IconComponent,
  size = "md",
  color,
  style,
}: BrandIconProps) {
  const colors = useThemeColors();
  const dimensions = sizeMap[size];

  const iconColor = color || colors.accent;
  const backgroundColor = (colors as any).accentBlueLighter || colors.border;

  return (
    <View
      style={[
        styles.container,
        {
          width: dimensions.container,
          height: dimensions.container,
          borderRadius: dimensions.container / 2,
          backgroundColor: backgroundColor,
        },
        style,
      ]}
    >
      <IconComponent
        width={dimensions.icon}
        height={dimensions.icon}
        color={iconColor}
        stroke={iconColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
});
