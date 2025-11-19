import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleProp, StyleSheet, TextStyle, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface ScreenSectionHeadingProps {
  title: string;
  subtitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

export function ScreenSectionHeading({
  title,
  subtitle,
  containerStyle,
  titleStyle,
  subtitleStyle,
}: ScreenSectionHeadingProps) {
  const colors = useThemeColors();

  return (
    <Animated.View entering={FadeInDown.delay(100).springify()}>
      <ThemedView style={[styles.container, containerStyle]}>
        <ThemedText
          style={[typography.subheading2, { color: colors.text }, titleStyle]}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            style={[
              typography.caption,
              styles.subtitle,
              { color: colors.textSecondary },
              subtitleStyle,
            ]}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  subtitle: {
    ...typography.caption,
  },
});
