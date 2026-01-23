import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ReportProgressBar } from "@/components/report/report-progress-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { ListOption } from "@/components/ui/list-option";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { submitReport } from "@/modules/report/api";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ReportReasonId =
  | "inappropriate"
  | "harassment"
  | "fake"
  | "inappropriate_content"
  | "other";

const reportReasons: { id: ReportReasonId; labelKey: string }[] = [
  {
    id: "inappropriate",
    labelKey: "bottomSheets.report.reasons.inappropriate",
  },
  { id: "harassment", labelKey: "bottomSheets.report.reasons.harassment" },
  { id: "fake", labelKey: "bottomSheets.report.reasons.fake" },
  {
    id: "inappropriate_content",
    labelKey: "bottomSheets.report.reasons.inappropriate_content",
  },
  { id: "other", labelKey: "bottomSheets.report.reasons.other" },
];

type Params = {
  reason?: string;
  name?: string;
  reportedUserId?: string;
};

export default function ReportModalScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<Params>();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedReason, setSelectedReason] = useState<string | undefined>(
    params.reason
  );
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const insets = useSafeAreaInsets();

  const handleSelectReason = (reason: string) => {
    setSelectedReason(reason);
    setCurrentStep(2);
  };

  const reasonLabel = useMemo(() => {
    if (!selectedReason) return "";
    const reasonKeyMap: Record<string, string> = {
      inappropriate: "bottomSheets.report.reasons.inappropriate",
      harassment: "bottomSheets.report.reasons.harassment",
      fake: "bottomSheets.report.reasons.fake",
      inappropriate_content:
        "bottomSheets.report.reasons.inappropriate_content",
      other: "bottomSheets.report.reasons.other",
    };
    const labelKey = reasonKeyMap[selectedReason] ?? selectedReason;
    return t(labelKey);
  }, [selectedReason]);

  const handleSubmit = async () => {
    if (!params.reportedUserId) {
      setSubmitError(t("errors.generic"));
      return;
    }

    const detailsText = details.trim();
    if (!detailsText) {
      setSubmitError(t("screens.report.detailsRequired"));
      return;
    }

    setSubmitError("");
    const reasonText =
      (reasonLabel ? `${reasonLabel} - ${detailsText}` : detailsText) ||
      t("bottomSheets.report.reasons.other");

    try {
      setIsSubmitting(true);
      await submitReport({
        reportedUserId: params.reportedUserId,
        category: selectedReason,
        reason: reasonText,
      });
      router.dismissAll();
    } catch (err) {
      setSubmitError(t("screens.report.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.dismissAll();
    }
  };

  const header = (
    <ScreenToolbar
      title={
        currentStep === 1
          ? t("screens.report.title")
          : t("screens.report.title")
      }
      leftAction={{
        icon: currentStep === 1 ? XIcon : ArrowLeftIcon,
        onClick: handleBack,
        ariaLabel: currentStep === 1 ? t("common.close") : t("common.back"),
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
          <ReportProgressBar currentStep={currentStep} />

          <View style={styles.content}>
            {currentStep === 1 ? (
              <View>
                <ThemedText
                  style={[
                    typography.body,
                    styles.subtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("bottomSheets.report.subtitle")}
                </ThemedText>

                <View style={styles.list}>
                  {reportReasons.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 && <View style={{ height: spacing.sm }} />}
                      <ListOption
                        label={t(item.labelKey)}
                        onPress={() => handleSelectReason(item.id)}
                        Icon={ArrowRightIcon}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              // Step 2: Details
              <>
                <ThemedText
                  style={[
                    typography.body,
                    styles.description,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("screens.report.description", { name: params.name ?? "" })}
                </ThemedText>

                <InputText
                  label={t("screens.report.detailsLabel")}
                  value={details}
                  onChangeText={setDetails}
                  placeholder={t("screens.report.placeholder")}
                  multiline
                  maxLength={500}
                  showCharacterCounter
                  containerStyle={{ marginBottom: spacing.md }}
                />
              </>
            )}
          </View>

          {currentStep === 2 && (
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
                disabled={isSubmitting}
                variant="default"
                loading={isSubmitting}
              />
            </View>
          )}
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
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.xs,
  },
  description: {
    lineHeight: 20,
  },
  helperText: {
    alignSelf: "flex-start",
    marginTop: spacing.xs / 2,
  },
  errorText: {
    alignSelf: "flex-start",
    marginTop: spacing.xs / 2,
  },
  footer: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
});
