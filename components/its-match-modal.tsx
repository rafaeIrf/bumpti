import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

type ItsMatchModalProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly name: string;
  readonly photoUrl?: string | null;
};

export function ItsMatchModal({
  isOpen,
  onClose,
  name,
  photoUrl,
}: ItsMatchModalProps) {
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
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <XIcon width={24} height={24} color={colors.textSecondary} />
            </Pressable>

            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t("modals.match.title")}
            </ThemedText>

            <View style={styles.photoWrapper}>
              {photoUrl ? (
                <RemoteImage
                  source={{ uri: photoUrl }}
                  style={styles.photo}
                />
              ) : (
                <View
                  style={[
                    styles.photoPlaceholder,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <ThemedText style={[styles.initial, { color: colors.text }]}>
                    {name.slice(0, 1).toUpperCase()}
                  </ThemedText>
                </View>
              )}
            </View>

            <ThemedText style={[styles.name, { color: colors.text }]}>
              {name}
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {t("modals.match.subtitle", { name })}
            </ThemedText>

            <Button
              label={t("common.continue")}
              onPress={onClose}
              size="lg"
              fullWidth
            />
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
    alignItems: "center",
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
  title: {
    ...typography.heading,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  photoWrapper: {
    width: 160,
    height: 200,
    borderRadius: spacing.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    ...typography.heading,
  },
  name: {
    ...typography.subheading,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
});
