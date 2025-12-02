import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { submitReport } from "@/modules/report/api";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Params = {
  reason?: string;
  name?: string;
  reportedUserId?: string;
};

export default function ReportModalScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<Params>();
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const reasonLabel = useMemo(() => {
    if (!params.reason) return "";
    const reasonKeyMap: Record<string, string> = {
      inappropriate: "bottomSheets.report.reasons.inappropriate",
      harassment: "bottomSheets.report.reasons.harassment",
      fake: "bottomSheets.report.reasons.fake",
      inappropriate_content: "bottomSheets.report.reasons.inappropriate_content",
      other: "bottomSheets.report.reasons.other",
    };
    const labelKey = reasonKeyMap[params.reason] ?? params.reason;
    return t(labelKey);
  }, [params.reason]);

  const handleSubmit = async () => {
    if (!params.reportedUserId) {
      Alert.alert(t("errors.generic"));
      return;
    }

    const reasonText =
      details.trim() || reasonLabel || t("bottomSheets.report.reasons.other");

    try {
      setIsSubmitting(true);
      await submitReport({
        reportedUserId: params.reportedUserId,
        category: params.reason,
        reason: reasonText,
      });
      Alert.alert(
        t("screens.report.successTitle"),
        t("screens.report.successMessage")
      );
      router.back();
    } catch (err) {
      Alert.alert(
        t("screens.report.submitErrorTitle"),
        t("screens.report.submitError")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const header = (
    <ScreenToolbar
      title={t("screens.report.title")}
      rightActions={{
        icon: XIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.close"),
      }}
    />
  );

  return (
    <BaseTemplateScreen TopHeader={header} isModal scrollEnabled={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
      >
        <ThemedView style={styles.container}>
          <View style={styles.content}>
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
          </View>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <Button
              label={t("screens.report.submit")}
              onPress={handleSubmit}
              size="lg"
              fullWidth
              variant="default"
              disabled={isSubmitting}
              loading={isSubmitting}
            />
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  content: {
    flex: 1,
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
    borderRadius: spacing.md,
    padding: spacing.md,
  },
  textArea: {
    minHeight: 160,
  },
  counter: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
  },
  footer: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
});
