import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";
import { Button } from "./ui/button";

interface PhotoActionsBottomSheetProps {
  onReplace: () => void;
  onRemove?: () => void;
  onAdd?: () => void;
  onCancel: () => void;
  canRemove: boolean;
}

export function PhotoActionsBottomSheet({
  onReplace,
  onRemove,
  onAdd,
  onCancel,
  canRemove,
}: PhotoActionsBottomSheetProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.title, { color: colors.text }]}>
        {t("components.photoActions.title")}
      </ThemedText>

      <View style={styles.actions}>
        <Button
          variant="default"
          label={t("components.photoActions.replace")}
          onPress={onReplace}
          size="lg"
          fullWidth
          style={styles.button}
        />

        {canRemove ? (
          <Button
            variant="destructive"
            size="lg"
            label={t("components.photoActions.remove")}
            onPress={onRemove}
            fullWidth
            style={styles.button}
          />
        ) : (
          <Button
            variant="default"
            size="lg"
            label={t("components.photoActions.add")}
            onPress={onAdd}
            fullWidth
            style={styles.button}
          />
        )}

        <Button
          variant="ghost"
          size="lg"
          label={t("common.cancel")}
          onPress={onCancel}
          fullWidth
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.body1,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  button: {
    justifyContent: "center",
  },
});
