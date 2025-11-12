import { LogOutIcon, MapPinIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

interface ConnectedBarProps {
  readonly venueName: string;
  readonly onLeave: () => void;
}

/**
 * ConnectedBar - Barra de status de conexão em local
 *
 * Exibe informações sobre o local onde o usuário está conectado
 * com opção de desconectar.
 *
 * Deve aparecer abaixo da toolbar na home quando o usuário
 * estiver conectado em algum lugar.
 */
export function ConnectedBar({ venueName, onLeave }: ConnectedBarProps) {
  const colors = useThemeColors();

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={styles.container}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Content */}
        <View style={styles.content}>
          {/* Label + Venue Name */}
          <View style={styles.textContainer}>
            <View style={styles.labelRow}>
              <MapPinIcon width={14} height={14} color={colors.accent} />
              <ThemedText
                style={[styles.label, { color: colors.textSecondary }]}
              >
                {t("connectedBar.label")}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.venueName, { color: colors.text }]}
              numberOfLines={1}
            >
              {venueName}
            </ThemedText>
          </View>

          {/* Leave Button */}
          <Pressable
            onPress={onLeave}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("connectedBar.leaveConfirmation.disconnect")}
            style={({ pressed }) => [
              styles.leaveButton,
              pressed && styles.leaveButtonPressed,
            ]}
          >
            <LogOutIcon width={16} height={16} color={colors.accent} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  card: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 16,
    borderWidth: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  textContainer: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  venueName: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  leaveButton: {
    marginTop: 2,
    padding: 4,
  },
  leaveButtonPressed: {
    opacity: 0.7,
  },
});
