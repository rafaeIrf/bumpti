import { FlagIcon, HeartCrackIcon, ShieldAlertIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";

type ActionId = "unmatch" | "block" | "report";

interface ChatActionsBottomSheetProps {
  readonly userName: string;
  readonly onUnmatch: () => void;
  readonly onBlock: () => void;
  readonly onReport: () => void;
  readonly onClose?: () => void;
  readonly containerStyle?: ViewStyle;
}

const actions: {
  id: ActionId;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
}[] = [
  {
    id: "unmatch",
    titleKey: "bottomSheets.chatActions.unmatchTitle",
    descriptionKey: "bottomSheets.chatActions.unmatchDescription",
    icon: HeartCrackIcon,
  },
  {
    id: "block",
    titleKey: "bottomSheets.chatActions.blockTitle",
    descriptionKey: "bottomSheets.chatActions.blockDescription",
    icon: ShieldAlertIcon,
  },
  {
    id: "report",
    titleKey: "bottomSheets.chatActions.reportTitle",
    descriptionKey: "bottomSheets.chatActions.reportDescription",
    icon: FlagIcon,
  },
];

export function ChatActionsBottomSheet({
  userName,
  onUnmatch,
  onBlock,
  onReport,
  onClose,
  containerStyle,
}: ChatActionsBottomSheetProps) {
  const colors = useThemeColors();

  const handleAction = (id: ActionId) => {
    onClose?.();
    // Aguarda a bottom sheet fechar antes de executar a ação
    setTimeout(() => {
      switch (id) {
        case "unmatch":
          onUnmatch();
          break;
        case "block":
          onBlock();
          break;
        case "report":
          onReport();
          break;
        default:
          break;
      }
    }, 300);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Drag indicator */}
      <View style={styles.dragIndicatorWrapper}>
        <View
          style={[styles.dragIndicator, { backgroundColor: colors.border }]}
        />
      </View>

      <View style={styles.listContent}>
        {actions.map((item, index) => {
          const Icon = item.icon;
          return (
            <View key={item.id}>
              {index > 0 && <View style={{ height: spacing.md }} />}
              <Pressable
                onPress={() => handleAction(item.id)}
                style={styles.actionRow}
                accessibilityRole="button"
                accessibilityLabel={t(item.titleKey, { name: userName })}
              >
                <View
                  style={[
                    styles.iconWrapper,
                    {
                      backgroundColor: `${colors.textSecondary}15`,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon width={20} height={20} color={colors.textSecondary} />
                </View>
                <View style={styles.textContainer}>
                  <ThemedText
                    style={[
                      typography.body1,
                      { color: colors.text, marginBottom: spacing.xs / 2 },
                    ]}
                  >
                    {t(item.titleKey, { name: userName })}
                  </ThemedText>
                  <ThemedText
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, lineHeight: 18 },
                    ]}
                  >
                    {t(item.descriptionKey, { name: userName })}
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          );
        })}
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
    paddingBottom: spacing.xl,
  },
  dragIndicatorWrapper: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  dragIndicator: {
    width: 48,
    height: 4,
    borderRadius: 2,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
  },
});
