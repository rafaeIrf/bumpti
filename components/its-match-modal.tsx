import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, ZoomIn } from "react-native-reanimated";

type ItsMatchModalProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSendMessage: () => void;
  readonly name: string;
  readonly photoUrl?: string | null;
};

export function ItsMatchModal({
  isOpen,
  onClose,
  onSendMessage,
  name,
  photoUrl,
}: ItsMatchModalProps) {
  const colors = useThemeColors();

  if (!isOpen) return null;

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
          <Animated.View
            entering={ZoomIn.duration(200).easing(Easing.linear)}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View
              style={[styles.photoWrapper, { borderColor: colors.surface }]}
            >
              {photoUrl ? (
                <RemoteImage source={{ uri: photoUrl }} style={styles.photo} />
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

            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t("modals.match.title")}
            </ThemedText>

            <ThemedText
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {t("modals.match.subtitle", { name })}
            </ThemedText>

            <View style={styles.actions}>
              <Button
                label={t("modals.match.actionPrimary")}
                onPress={onSendMessage}
                size="lg"
                fullWidth
              />
              <Button
                label={t("modals.match.actionSecondary")}
                onPress={onClose}
                size="lg"
                variant="ghost"
                fullWidth
              />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  center: {
    width: "100%",
    padding: spacing.lg,
    alignItems: "center",
  },
  card: {
    width: "100%",
    borderRadius: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: 80 + spacing.xs, // Space for the popped-out photo
    alignItems: "center",
    overflow: "visible", // Allow photo to pop out
  },
  title: {
    ...typography.heading1,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
  },
  photoWrapper: {
    position: "absolute",
    top: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6, // Thick border
    overflow: "hidden",
    alignSelf: "center",
    zIndex: 1,
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
    ...typography.heading2,
    marginBottom: spacing.md,
  },
});
