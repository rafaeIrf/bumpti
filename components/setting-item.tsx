import { ArrowRightIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SvgProps } from "react-native-svg";

export interface SettingItemProps {
  icon?: React.FC<SvgProps>;
  title: string;
  description?: string;
  rightContent?: React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
}

export function SettingItem({
  icon: Icon,
  title,
  description,
  rightContent,
  onClick,
  showChevron = true,
}: SettingItemProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onClick}
      disabled={!onClick}
      style={({ pressed }) => [
        styles.settingItem,
        {
          backgroundColor: colors.surface,
          opacity: onClick && pressed ? 0.9 : 1,
          transform: [{ scale: onClick && pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.settingItemContent}>
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon width={20} height={20} color={colors.text} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <ThemedText style={[typography.body, { color: colors.text }]}>
            {title}
          </ThemedText>
          {description && (
            <ThemedText
              style={[
                typography.caption,
                { color: "rgba(255, 255, 255, 0.5)", marginTop: 2 },
              ]}
            >
              {description}
            </ThemedText>
          )}
        </View>
        {rightContent ? (
          <View>{rightContent}</View>
        ) : showChevron ? (
          <ArrowRightIcon width={20} height={20} color={colors.text} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  settingItem: {
    borderRadius: 16,
    padding: spacing.md,
  },
  settingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
});
