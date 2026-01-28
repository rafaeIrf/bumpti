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
  /** Whether to show checkmark when selected (default: true) */
  readonly showCheckmark?: boolean;
}

export function SelectionCard({
  label,
  description,
  isSelected,
  onPress,
  testID,
  icon: Icon,
  showCheckmark = true,
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
        {Icon && (
          <Icon
            width={24}
            height={24}
            color={isSelected ? colors.accent : colors.textSecondary}
          />
        )}
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
        {isSelected && showCheckmark && (
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.lg,
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
