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
  readonly Icon?: React.FC<{
    width?: number;
    height?: number;
    color?: string;
    style?: any;
  }>;
}

/**
 * GenericConnectionBottomSheet - Conteúdo reutilizável para Bottom Sheets de conexão
 *
 * Estilo Dark Social Premium refinado
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
  Icon,
}: GenericConnectionBottomSheetProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Visual Header (Icon Anchor) */}
      {Icon && (
        <View style={styles.iconWrapper}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.accent + "15" },
            ]}
          >
            <Icon width={32} height={32} color={colors.accent} />
          </View>
        </View>
      )}

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
          {/* Título (Venue Name - Context) */}
          <ThemedText
            style={[
              styles.title,
              typography.subheading,
              { color: colors.textSecondary },
            ]}
          >
            {title}
          </ThemedText>

          {/* Subtítulo (Main Message - Hero) */}
          {subtitle && (
            <ThemedText
              style={[
                styles.subtitle,
                typography.heading1,
                { color: colors.text },
              ]}
            >
              {subtitle}
            </ThemedText>
          )}

          {/* Texto de apoio (Details - Secondary) */}
          {supportText && (
            <ThemedText
              style={[
                styles.supportText,
                typography.body,
                { color: colors.textSecondary },
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    position: "relative",
  },
  iconWrapper: {
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
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
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.8,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    lineHeight: 32,
  },
  supportText: {
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    lineHeight: 22,
    opacity: 0.9,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.sm,
  },
  microcopy: {
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    opacity: 0.6,
  },
});
