import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface ConnectionButton {
  text: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

interface GenericConnectionBottomSheetProps {
  readonly title: string | ReactNode;
  readonly subtitle?: string | ReactNode;
  readonly supportText?: string | ReactNode;
  readonly primaryButton?: ConnectionButton;
  readonly secondaryButton?: ConnectionButton;
  readonly microcopy?: string | ReactNode;
  readonly customContent?: ReactNode;
  readonly onClose?: () => void;
}

/**
 * GenericConnectionBottomSheet - Conteúdo reutilizável para Bottom Sheets de conexão
 *
 * Estilo Dark Social Premium refinado
 * Usa tema do app e cores customizadas para dark mode
 * Tipografia: Poppins SemiBold / Medium / Regular (via typography tokens)
 *
 * Este componente contém apenas o conteúdo.
 * Use o hook `useBottomSheet()` do projeto para exibir.
 */
export function GenericConnectionBottomSheet({
  title,
  subtitle,
  supportText,
  primaryButton,
  secondaryButton,
  microcopy,
  customContent,
  onClose,
}: GenericConnectionBottomSheetProps) {
  const colors = useThemeColors();

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

      {/* Custom Content ou Layout Padrão */}
      {customContent || (
        <View style={styles.defaultContent}>
          {/* Título */}
          <ThemedText
            style={[styles.title, typography.heading, { color: colors.text }]}
          >
            {title}
          </ThemedText>

          {/* Subtítulo */}
          {subtitle && (
            <ThemedText
              style={[
                styles.subtitle,
                typography.body,
                { color: colors.textSecondary },
              ]}
            >
              {subtitle}
            </ThemedText>
          )}

          {/* Texto de apoio */}
          {supportText && (
            <ThemedText
              style={[
                styles.supportText,
                typography.body,
                { color: colors.text },
              ]}
            >
              {supportText}
            </ThemedText>
          )}

          {/* Buttons */}
          {(primaryButton || secondaryButton) && (
            <View style={styles.buttonsContainer}>
              {/* Primary Button */}
              {primaryButton && (
                <Button
                  onPress={primaryButton.onClick}
                  variant={
                    primaryButton.variant === "secondary"
                      ? "secondary"
                      : "default"
                  }
                  size="lg"
                  fullWidth
                  label={primaryButton.text}
                />
              )}

              {/* Secondary Button */}
              {secondaryButton && (
                <Button
                  onPress={secondaryButton.onClick}
                  variant={
                    secondaryButton.variant === "primary"
                      ? "default"
                      : "secondary"
                  }
                  size="lg"
                  fullWidth
                  label={secondaryButton.text}
                />
              )}
            </View>
          )}

          {/* Microcopy */}
          {microcopy && (
            <ThemedText
              style={[
                styles.microcopy,
                typography.caption,
                { color: colors.textSecondary },
              ]}
            >
              {microcopy}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    position: "relative",
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
  defaultContent: {
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: 17,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  supportText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.sm,
  },
  microcopy: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.lg,
  },
});
