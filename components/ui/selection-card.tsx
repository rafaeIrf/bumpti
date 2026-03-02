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
  /** Optional icon component to display on the left */
  readonly icon?: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  /** Optional custom left element (takes precedence over icon) */
  readonly leftElement?: React.ReactNode;
  /** Whether to show checkmark when selected (default: true) */
  readonly showCheckmark?: boolean;
  /** Custom accent color for selected state (border, tint, check icon) */
  readonly accentColor?: string;
  /** Whether the card is disabled (e.g. max selections reached) */
  readonly disabled?: boolean;
}

export function SelectionCard({
  label,
  description,
  isSelected,
  onPress,
  testID,
  icon: Icon,
  leftElement,
  showCheckmark = true,
  accentColor,
  disabled = false,
}: SelectionCardProps) {
  const colors = useThemeColors();
  const accent = accentColor || colors.accent;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled && !isSelected}
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? `${accent}3A` : colors.surface,
          borderColor: isSelected ? accent : "transparent",
          opacity: disabled && !isSelected ? 0.4 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {leftElement
          ? leftElement
          : Icon && (
              <Icon
                width={24}
                height={24}
                color={isSelected ? accent : colors.textSecondary}
              />
            )}
        <View style={{ flex: 1 }}>
          <ThemedText
            numberOfLines={1}
            style={[
              {
                ...(description ? typography.body1 : typography.body),
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
        {isSelected && showCheckmark && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ marginLeft: spacing.sm }}
          >
            <CheckIcon width={20} height={20} color={accent} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
