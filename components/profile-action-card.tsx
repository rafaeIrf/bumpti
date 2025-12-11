import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface ProfileActionCardProps {
  readonly icon: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  readonly titleKey: string;
  readonly onPress: () => void;
}

export function ProfileActionCard({
  icon: Icon,
  titleKey,
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
        <View
          style={[
            styles.actionCardIcon,
            {
              backgroundColor:
                (colors as any).accentBorderFaint ??
                (colors as any).accentBlueLight ??
                colors.border,
            },
          ]}
        >
          <Icon width={20} height={20} color={colors.accent} />
        </View>
        <ThemedText
          style={[
            typography.captionBold,
            { color: colors.text, textAlign: "center" },
          ]}
        >
          {titleKey}
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
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
