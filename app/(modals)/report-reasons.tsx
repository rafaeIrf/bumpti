import { ArrowRightIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ListOption } from "@/components/ui/list-option";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

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
  name: string;
  reportedUserId: string;
};

export default function ReportReasonsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<Params>();

  const handleSelectReason = (reason: ReportReasonId) => {
    router.push({
      pathname: "/(modals)/report",
      params: {
        reason,
        name: params.name,
        reportedUserId: params.reportedUserId,
      },
    });
  };

  const header = (
    <ScreenToolbar
      title={t("bottomSheets.report.title", { name: params.name ?? "" })}
      leftAction={{
        icon: XIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.close"),
      }}
    />
  );

  return (
    <BaseTemplateScreen TopHeader={header} isModal>
      <ThemedView style={styles.container}>
        <View style={styles.content}>
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
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.xs,
  },
});
