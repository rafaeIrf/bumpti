import {
  CalendarIcon,
  CompassIcon,
  MapPinIcon,
  SparklesIcon,
  StarIcon,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { getRelativeDate } from "@/utils/date";
import { StyleSheet, View } from "react-native";
import { BrandIcon } from "./ui/brand-icon";

export type MatchOriginType =
  | "live"
  | "direct_overlap"
  | "vibe_match"
  | "routine_match"
  | "path_match"
  | "regular"
  | "planning"
  | "mixed"
  | null
  | undefined;

type MatchMetadata = {
  shared_interests?: number;
  shared_places?: number;
  overlap_seconds?: number;
};

type MatchPlaceCardProps = {
  placeName: string;
  matchedAt?: string;
  photoUrl?: string;
  matchOrigin?: MatchOriginType;
  matchMetadata?: string | null;
};

/**
 * Returns the icon, label key, and accent override for a given match origin type.
 */
function getOriginConfig(origin: MatchOriginType) {
  switch (origin) {
    case "live":
      return {
        icon: MapPinIcon,
        labelKey: "screens.chatMessages.matchOrigin.live" as const,
      };
    case "direct_overlap":
      return {
        icon: MapPinIcon,
        labelKey: "screens.chatMessages.matchOrigin.directOverlap" as const,
      };
    case "vibe_match":
      return {
        icon: SparklesIcon,
        labelKey: "screens.chatMessages.matchOrigin.vibeMatch" as const,
      };
    case "routine_match":
    case "path_match":
      return {
        icon: CompassIcon,
        labelKey: "screens.chatMessages.matchOrigin.pathMatch" as const,
      };
    case "regular":
      return {
        icon: StarIcon,
        labelKey: "screens.chatMessages.matchOrigin.regular" as const,
      };
    case "planning":
      return {
        icon: CalendarIcon,
        labelKey: "screens.chatMessages.matchOrigin.planning" as const,
      };
    case "mixed":
      return {
        icon: MapPinIcon,
        labelKey: "screens.chatMessages.matchOrigin.mixed" as const,
      };
    default:
      return {
        icon: MapPinIcon,
        labelKey: "screens.chatMessages.connectedHere" as const,
      };
  }
}

function parseMetadata(raw?: string | null): MatchMetadata | null {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function getContextLabel(
  origin: MatchOriginType,
  metadata: MatchMetadata | null,
): string | null {
  if (!metadata) return null;

  if (
    origin === "vibe_match" &&
    metadata.shared_interests &&
    metadata.shared_interests > 0
  ) {
    return t("screens.chatMessages.matchContext.sharedInterests", {
      count: metadata.shared_interests,
    });
  }

  if (
    (origin === "routine_match" || origin === "path_match") &&
    metadata.shared_places &&
    metadata.shared_places > 0
  ) {
    return t("screens.chatMessages.matchContext.sharedPlaces", {
      count: metadata.shared_places,
    });
  }

  return null;
}

export function MatchPlaceCard({
  placeName,
  matchedAt,
  photoUrl,
  matchOrigin,
  matchMetadata,
}: MatchPlaceCardProps) {
  const colors = useThemeColors();
  const relativeDate = getRelativeDate(matchedAt);
  const { icon, labelKey } = getOriginConfig(matchOrigin);
  const metadata = parseMetadata(matchMetadata);
  const contextLabel = getContextLabel(matchOrigin, metadata);

  return (
    <View style={styles.container}>
      <ThemedView style={[styles.card]}>
        <BrandIcon icon={icon} color={colors.accent} />
        {/* Origin label */}
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
          {t(labelKey)}
        </ThemedText>

        {/* Contextual metadata */}
        {contextLabel && (
          <ThemedText
            style={[
              typography.caption,
              {
                color: colors.accent,
                textAlign: "center",
                marginBottom: spacing.xs,
              },
            ]}
          >
            {contextLabel}
          </ThemedText>
        )}

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

        {/* Date */}
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

        {/* User photo */}
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
