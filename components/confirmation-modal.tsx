import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Modal, Pressable, StyleSheet, View, ViewStyle } from "react-native";

export interface ConfirmationModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly description: string;
  readonly confirmText: string;
  readonly cancelText?: string;
  readonly isDangerous?: boolean;
  readonly containerStyle?: ViewStyle;
}

/**
 * Generic confirmation modal using native Modal.
 * Provide already-localized title/description/confirmText via props.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText = t("common.cancel"),
  isDangerous = false,
  containerStyle,
}: ConfirmationModalProps) {
  const colors = useThemeColors();

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
                { color: colors.text, marginBottom: spacing.sm },
              ]}
            >
              {title}
            </ThemedText>

            <ThemedText
              style={[
                typography.body,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              {description}
            </ThemedText>

            <View style={styles.actions}>
              <Button
                label={confirmText}
                onPress={onConfirm}
                size="lg"
                fullWidth
                variant={isDangerous ? "destructive" : "default"}
              />
              <Button
                label={cancelText}
                onPress={onClose}
                size="lg"
                fullWidth
                variant="secondary"
              />
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
