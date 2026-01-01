import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SvgProps } from "react-native-svg";
import { BrandIcon } from "./ui/brand-icon";

interface ProfileActionCardProps {
  readonly icon: React.ComponentType<SvgProps>;
  readonly title: string;
  readonly onPress: () => void;
}

export function ProfileActionCard({
  icon: Icon,
  title,
  onPress,
}: ProfileActionCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable onPress={onPress} style={styles.actionCard}>
      <View
        style={[
          styles.actionCardGradient,
          { backgroundColor: colors.background },
        ]}
      >
        <BrandIcon icon={Icon} size="sm" />
        <ThemedText
          style={[
            typography.captionBold,
            { color: colors.text, textAlign: "center" },
          ]}
        >
          {title}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    flex: 1,
    height: 112,
  },
  actionCardGradient: {
    flex: 1,
    borderRadius: spacing.xl,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
    borderWidth: 1,
  },
});
