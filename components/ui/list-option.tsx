import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export interface ListOptionProps {
  readonly label: string;
  readonly Icon?: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function ListOption({ label, Icon, onPress, testID }: ListOptionProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <ThemedText style={[typography.body, { color: colors.text, flex: 1 }]}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.iconWrapper,
          { backgroundColor: `${colors.textSecondary}15` },
        ]}
      >
        {Icon ? (
          <Icon width={18} height={18} color={colors.textSecondary} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
