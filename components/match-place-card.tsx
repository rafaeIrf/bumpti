import { MapPinIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { StyleSheet, Text, View } from "react-native";

type MatchPlaceCardProps = {
  placeName: string;
};

export function MatchPlaceCard({ placeName }: MatchPlaceCardProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <ThemedView
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <ThemedText
            style={[
              typography.body,
              {
                color: colors.text,
              },
            ]}
          >
            <MapPinIcon width={12} height={12} color={colors.accent} />{" "}
            <Text>{placeName}</Text>
          </ThemedText>
        </View>
        <ThemedText
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: spacing.xs,
            },
          ]}
        >
          {t("screens.chatMessages.connectedHere")}
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: {
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    width: "100%",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
