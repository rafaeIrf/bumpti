import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

type Params = {
  reason?: string;
  name?: string;
};

export default function ReportModalScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<Params>();
  const [details, setDetails] = useState("");

  const reasonLabel = useMemo(() => params.reason ?? "", [params.reason]);

  const handleSubmit = () => {
    // TODO: integrate with report submission edge function
    console.log("report submit", {
      reason: reasonLabel,
      details,
      name: params.name,
    });
    router.back();
  };

  const header = (
    <ScreenToolbar
      title={t("screens.report.title")}
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.back"),
      }}
    />
  );

  return (
    <BaseTemplateScreen TopHeader={header} isModal>
      <ThemedView style={styles.container}>
        <ThemedText
          style={[
            typography.body,
            styles.description,
            { color: colors.textSecondary },
          ]}
        >
          {t("screens.report.description", { name: params.name ?? "" })}
        </ThemedText>

        <ThemedText
          style={[typography.caption, styles.label, { color: colors.text }]}
        >
          {t("screens.report.detailsLabel")}
        </ThemedText>

        <View
          style={[
            styles.textAreaWrapper,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={t("screens.report.placeholder")}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
            textAlignVertical="top"
            style={[
              styles.textArea,
              { color: colors.text, ...typography.body },
            ]}
          />
        </View>
        <ThemedText
          style={[
            typography.caption,
            styles.counter,
            { color: colors.textSecondary },
          ]}
        >
          {t("screens.report.counter", { count: details.length })}
        </ThemedText>

        <View style={styles.actions}>
          <Button
            label={t("screens.report.submit")}
            onPress={handleSubmit}
            size="lg"
            fullWidth
            variant="default"
          />
          <Button
            label={t("common.cancel")}
            onPress={() => router.back()}
            size="lg"
            fullWidth
            variant="secondary"
          />
        </View>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  description: {
    lineHeight: 20,
  },
  label: {
    marginBottom: spacing.xs,
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: spacing.lg,
    padding: spacing.md,
  },
  textArea: {
    minHeight: 160,
  },
  counter: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    rowGap: spacing.sm,
  },
});
