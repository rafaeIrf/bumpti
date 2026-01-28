import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { ActivityIndicator, StyleSheet, View, ViewStyle } from "react-native";

type LoadingViewProps = {
  readonly style?: ViewStyle;
  readonly size?: "small" | "large";
  readonly color?: string;
};

export function LoadingView({
  style,
  size = "large",
  color,
}: LoadingViewProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      <ActivityIndicator size={size} color={color ?? colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
