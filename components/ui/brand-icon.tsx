import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { ComponentType, ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SvgProps } from "react-native-svg";

export type BrandIconSize = "sm" | "md" | "lg" | "xl";

export interface BrandIconProps {
  icon?: ComponentType<SvgProps>;
  children?: ReactNode;
  size?: BrandIconSize;
  color?: string;
  style?: ViewStyle;
  withShadow?: boolean;
}

const sizeMap = {
  sm: { container: 40, icon: 20 },
  md: { container: 56, icon: 28 },
  lg: { container: 72, icon: 32 },
  xl: { container: 96, icon: 48 },
};

export function BrandIcon({
  icon: IconComponent,
  children,
  size = "md",
  color,
  style,
  withShadow = false,
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
        withShadow && styles.shadow,
        style,
      ]}
    >
      {children ? (
        children
      ) : IconComponent ? (
        <IconComponent
          width={dimensions.icon}
          height={dimensions.icon}
          color={iconColor}
          stroke={iconColor}
        />
      ) : null}
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
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
});
