import { ThemedText } from "@/components/themed-text";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet } from "react-native";

export function MapDataAttribution() {
  const colors = useThemeColors();

  return (
    <ThemedText
      style={[
        styles.attribution,
        {
          color: colors.textSecondary,
          opacity: 0.4,
        },
      ]}
    >
      {t("legal.map_data")}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  attribution: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },
});
