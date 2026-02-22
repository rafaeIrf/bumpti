import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function MapScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  logger.log("[MapScreen] Map screen opened");

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.map.title")}
          rightActions={[
            {
              icon: XIcon,
              onClick: () => router.back(),
              ariaLabel: t("common.close"),
              color: colors.icon,
            },
          ]}
        />
      }
    >
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ThemedText style={[typography.heading, { color: colors.text }]}>
            {t("screens.map.comingSoon")}
          </ThemedText>
          <ThemedText
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: spacing.sm,
                textAlign: "center",
              },
            ]}
          >
            {t("screens.map.comingSoonDescription")}
          </ThemedText>
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
});
