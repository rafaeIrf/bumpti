import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button, ButtonProps, ButtonSize } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Modal, Pressable, StyleSheet, View, ViewStyle } from "react-native";

export interface ConfirmationModalAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonProps["variant"];
}

export interface ConfirmationModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ConfirmationModalAction[];
  readonly buttonSize?: ButtonSize;
  readonly containerStyle?: ViewStyle;
  // Legacy props for backward compatibility
  readonly onConfirm?: () => void;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly isDangerous?: boolean;
}

/**
 * Generic confirmation modal using native Modal.
 * Provide already-localized title/description via props.
 * Supports custom actions or legacy confirm/cancel pattern.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  title,
  description,
  actions,
  buttonSize = "lg",
  containerStyle,
  // Legacy props
  onConfirm,
  confirmText,
  cancelText = t("common.cancel"),
  isDangerous = false,
}: ConfirmationModalProps) {
  const colors = useThemeColors();

  // Use custom actions if provided, otherwise fall back to legacy confirm/cancel
  const finalActions: ConfirmationModalAction[] = actions || [
    {
      label: confirmText!,
      onPress: onConfirm!,
      variant: isDangerous ? "destructive" : "default",
    },
    {
      label: cancelText,
      onPress: onClose,
      variant: "secondary",
    },
  ];

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.backdrop]}
          onPress={onClose}
          pointerEvents="box-only"
        />
        <View style={styles.center} pointerEvents="box-none">
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface },
              containerStyle,
            ]}
          >
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <XIcon width={24} height={24} color={colors.textSecondary} />
            </Pressable>

            <ThemedText
              style={[
                typography.subheading,
                {
                  color: colors.text,
                  marginBottom: description ? spacing.sm : spacing.lg,
                },
              ]}
            >
              {title}
            </ThemedText>

            {description && (
              <ThemedText
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginBottom: spacing.lg },
                ]}
              >
                {description}
              </ThemedText>
            )}

            <View style={styles.actions}>
              {finalActions.map((action, index) => (
                <Button
                  key={index}
                  label={action.label}
                  onPress={action.onPress}
                  size={buttonSize}
                  fullWidth
                  variant={action.variant || "default"}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    borderRadius: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    rowGap: spacing.sm,
  },
});
