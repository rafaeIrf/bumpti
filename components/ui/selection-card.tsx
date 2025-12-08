import { CheckIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export interface SelectionCardProps {
  readonly label: string;
  readonly description?: string;
  readonly isSelected: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function SelectionCard({
  label,
  description,
  isSelected,
  onPress,
  testID,
}: SelectionCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? `${colors.accent}1A` : colors.surface,
          borderColor: isSelected ? colors.accent : colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={{ flex: 1 }}>
          <ThemedText
            style={[
              styles.label,
              {
                color: isSelected ? colors.text : colors.textSecondary,
              },
            ]}
          >
            {label}
          </ThemedText>
          {description && (
            <ThemedText
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  marginTop: 2,
                },
              ]}
            >
              {description}
            </ThemedText>
          )}
        </View>
        {isSelected && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ marginLeft: spacing.sm }}
          >
            <CheckIcon width={20} height={20} color={colors.accent} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    fontSize: 16,
    fontWeight: "600",
  },
});
