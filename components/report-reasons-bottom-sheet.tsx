import { ArrowRightIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ListOption } from "@/components/ui/list-option";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

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

interface ReportReasonsBottomSheetProps {
  readonly userName: string;
  readonly onSelectReason: (reason: ReportReasonId) => void;
  readonly onClose?: () => void;
  readonly containerStyle?: ViewStyle;
}

/**
 * Bottom sheet content for selecting a report reason.
 * Use with the app BottomSheetProvider (useBottomSheet).
 */
export function ReportReasonsBottomSheet({
  userName,
  onSelectReason,
  onClose,
  containerStyle,
}: ReportReasonsBottomSheetProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.dragIndicatorWrapper}>
        <View
          style={[styles.dragIndicator, { backgroundColor: colors.border }]}
        />
      </View>

      <View style={styles.header}>
        <ThemedText
          style={[typography.subheading, styles.title, { color: colors.text }]}
        >
          {t("bottomSheets.report.title", { name: userName })}
        </ThemedText>
        <ThemedText
          style={[
            typography.body,
            styles.subtitle,
            { color: colors.textSecondary },
          ]}
        >
          {t("bottomSheets.report.subtitle")}
        </ThemedText>
      </View>

      <View style={styles.listContent}>
        {reportReasons.map((item, index) => (
          <View key={item.id}>
            {index > 0 && <View style={{ height: spacing.sm }} />}
            <ListOption
              label={t(item.labelKey)}
              onPress={() => onSelectReason(item.id)}
              Icon={ArrowRightIcon}
            />
          </View>
        ))}
        <View style={{ height: spacing.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    overflow: "hidden",
  },
  dragIndicatorWrapper: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  dragIndicator: {
    width: 48,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  reasonItem: {
    borderWidth: 1,
    borderRadius: spacing.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
