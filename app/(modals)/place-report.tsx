import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ReportProgressBar } from "@/components/report/report-progress-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { ListOption } from "@/components/ui/list-option";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { createPlaceReport } from "@/modules/places/api";
import { PlaceReportReason } from "@/modules/places/types";
import { logger } from "@/utils/logger";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const reportReasons: { id: PlaceReportReason; labelKey: string }[] = [
  { id: "closed", labelKey: "bottomSheets.placeReport.reasons.closed" },
  { id: "wrong_info", labelKey: "bottomSheets.placeReport.reasons.wrong_info" },
  {
    id: "does_not_exist",
    labelKey: "bottomSheets.placeReport.reasons.does_not_exist",
  },
  {
    id: "inappropriate",
    labelKey: "bottomSheets.placeReport.reasons.inappropriate",
  },
  { id: "other", labelKey: "bottomSheets.placeReport.reasons.other" },
];

export default function PlaceReportScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { placeId, placeName } = useLocalSearchParams<{
    placeId: string;
    placeName: string;
  }>();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedReason, setSelectedReason] =
    useState<PlaceReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectReason = (reason: PlaceReportReason) => {
    setSelectedReason(reason);
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason || !placeId) return;

    setIsSubmitting(true);
    try {
      const result = await createPlaceReport({
        placeId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      if (result.success) {
        Alert.alert(t("bottomSheets.placeReport.success"), undefined, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t("common.error"), t("bottomSheets.placeReport.error"));
      }
    } catch (error) {
      logger.error("Error submitting place report", { error });
      Alert.alert(t("common.error"), t("bottomSheets.placeReport.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonLabel = useMemo(() => {
    const reason = reportReasons.find((r) => r.id === selectedReason);
    return reason ? t(reason.labelKey) : "";
  }, [selectedReason]);

  const header = (
    <ScreenToolbar
      title={t("bottomSheets.placeReport.title")}
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
                    typography.heading,
                    styles.subtitle,
                    { color: colors.text },
                  ]}
                >
                  {t("bottomSheets.placeReport.title")}
                </ThemedText>

                <ThemedText
                  style={[
                    typography.body,
                    styles.helperText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("bottomSheets.placeReport.subtitle")}
                </ThemedText>

                {placeName && (
                  <View style={styles.placeContext}>
                    <ThemedText
                      style={[
                        typography.caption,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("bottomSheets.placeReport.placeLabel")}
                    </ThemedText>
                    <ThemedText
                      style={[typography.subheading, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {placeName}
                    </ThemedText>
                  </View>
                )}

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
                    typography.subheading,
                    styles.description,
                    { color: colors.text },
                  ]}
                >
                  {reasonLabel}
                </ThemedText>

                <InputText
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t(
                    "bottomSheets.placeReport.descriptionPlaceholder"
                  )}
                  multiline
                  maxLength={500}
                  showCharacterCounter
                  containerStyle={{ marginBottom: spacing.md }}
                />

                <View style={styles.submitWrapper}>
                  <Button
                    label={
                      isSubmitting
                        ? t("bottomSheets.placeReport.submitting")
                        : t("bottomSheets.placeReport.submit")
                    }
                    onPress={handleSubmit}
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  />
                </View>
              </>
            )}
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
  },
  content: {
    flex: 1,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  subtitle: {
    textAlign: "left",
    marginBottom: spacing.xs,
  },
  helperText: {
    textAlign: "left",
    marginBottom: spacing.lg,
  },
  placeContext: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: "rgba(0,0,0,0.03)", // subtle background
  },
  placeName: {
    // moved to inline style for context
  },
  list: {
    gap: spacing.xs,
  },
  submitWrapper: {
    marginTop: "auto",
    paddingBottom: spacing.lg,
  },
});
