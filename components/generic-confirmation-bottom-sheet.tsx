import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { ComponentType, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface ButtonConfig {
  text: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
}

interface GenericConfirmationBottomSheetProps {
  readonly title: string;
  readonly description?: string | ReactNode;
  readonly icon?: ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  readonly primaryButton: ButtonConfig;
  readonly secondaryButton?: ButtonConfig;
  readonly onClose?: () => void;
}

/**
 * GenericConfirmationBottomSheet - Conteúdo reutilizável para confirmações
 *
 * Bottom sheet genérico para confirmações, ações destrutivas e alertas.
 * Suporta ícone opcional, título, descrição e até 2 botões de ação.
 *
 * Este componente contém apenas o conteúdo.
 * Use o hook `useBottomSheet()` do projeto para exibir.
 */
export function GenericConfirmationBottomSheet({
  title,
  description,
  icon: Icon,
  primaryButton,
  secondaryButton,
  onClose,
}: GenericConfirmationBottomSheetProps) {
  const colors = useThemeColors();

  const getButtonVariant = (variant: ButtonConfig["variant"] = "primary") => {
    switch (variant) {
      case "danger":
        return "destructive" as const;
      case "secondary":
        return "secondary" as const;
      case "primary":
      default:
        return "default" as const;
    }
  };

  return (
    <View style={styles.container}>
      {/* Close Button */}
      {onClose && (
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <XIcon width={24} height={24} color={colors.textSecondary} />
        </Pressable>
      )}

      {/* Icon (opcional) */}
      {Icon && (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${colors.accent}15` },
          ]}
        >
          <Icon width={28} height={28} color={colors.accent} />
        </View>
      )}

      {/* Title */}
      <ThemedText
        style={[styles.title, typography.heading, { color: colors.text }]}
      >
        {title}
      </ThemedText>

      {/* Description */}
      {description && (
        <ThemedText
          style={[
            styles.description,
            typography.body,
            { color: colors.textSecondary },
          ]}
        >
          {description}
        </ThemedText>
      )}

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        {/* Primary Button */}
        <Button
          onPress={primaryButton.onClick}
          variant={getButtonVariant(primaryButton.variant)}
          size="lg"
          fullWidth
          label={primaryButton.text}
        />

        {/* Secondary Button (opcional) */}
        {secondaryButton && (
          <Button
            onPress={secondaryButton.onClick}
            variant={getButtonVariant(secondaryButton.variant)}
            size="lg"
            fullWidth
            label={secondaryButton.text}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    position: "relative",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: spacing.sm,
    lineHeight: 26,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.sm,
  },
});
