import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

export function Divider({ style, ...props }: ViewProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[styles.divider, { backgroundColor: colors.border }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: "100%",
  },
});
