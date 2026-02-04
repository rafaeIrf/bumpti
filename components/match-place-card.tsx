import { MapPinIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { getRelativeDate } from "@/utils/date";
import { StyleSheet, View } from "react-native";
import { BrandIcon } from "./ui/brand-icon";

type MatchPlaceCardProps = {
  placeName: string;
  matchedAt?: string;
  photoUrl?: string;
};

export function MatchPlaceCard({
  placeName,
  matchedAt,
  photoUrl,
}: MatchPlaceCardProps) {
  const colors = useThemeColors();
  const relativeDate = getRelativeDate(matchedAt);

  return (
    <View style={styles.container}>
      <ThemedView style={[styles.card]}>
        <BrandIcon icon={MapPinIcon} color={colors.accent} />
        {/* Título */}
        <ThemedText
          style={[
            typography.body,
            {
              color: colors.textSecondary,
              textAlign: "center",
              marginVertical: spacing.sm,
            },
          ]}
        >
          {t("screens.chatMessages.connectedHere")}
        </ThemedText>

        <View style={styles.placeRow}>
          <ThemedText
            style={[
              typography.body1,
              {
                color: colors.text,
                textAlign: "center",
                marginLeft: spacing.xs,
              },
            ]}
          >
            {placeName}
          </ThemedText>
        </View>

        {/* Data */}
        {relativeDate && (
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
            {relativeDate}
          </ThemedText>
        )}

        {/* Foto do usuário */}
        {photoUrl && (
          <View style={styles.photoContainer}>
            <RemoteImage
              source={{ uri: photoUrl }}
              style={[styles.photo, { borderColor: colors.border }]}
              contentFit="cover"
            />
          </View>
        )}
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
    alignItems: "center",
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  photoContainer: {
    marginTop: spacing.md,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
});
