import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import type { DetectedPlace } from "@/modules/places/api";
import * as Haptics from "expo-haptics";
import { useFeatureFlag, usePostHog } from "posthog-react-native";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

// Location pin icon
function LocationPinIcon({
  size = 18,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface DetectionBannerProps {
  place: DetectedPlace;
  onConnect: (place: DetectedPlace) => void;
  onDismiss?: () => void;
  isConnecting?: boolean;
}

export function DetectionBanner({
  place,
  onConnect,
  onDismiss,
  isConnecting = false,
}: DetectionBannerProps) {
  const colors = useThemeColors();
  const [show, setShow] = React.useState(false);
  const posthog = usePostHog();
  const ctaVariant = useFeatureFlag("detect-place-cta-test");
  const ctaLabel =
    ctaVariant === "variant-entrar"
      ? t("screens.home.detectionBanner.connectEntrar")
      : t("screens.home.detectionBanner.connect");

  useEffect(() => {
    if (place) {
      setShow(true);
      // Trigger haptic feedback when place is detected
      Haptics.selectionAsync();
    }
  }, [place]);

  const handleDismiss = () => {
    setShow(false);
    // Delay calling parent's onDismiss to allow exit animation
    setTimeout(() => {
      onDismiss?.();
    }, 400);
  };

  const handleConnect = () => {
    Haptics.selectionAsync();
    posthog?.capture("detect_place_connect_clicked", {
      place_id: place.id,
      cta_variant: ctaVariant || "control",
      cta_text: ctaLabel,
      active_users: place.active_users || 0,
    });
    onConnect(place);
  };

  // Render only if place exists and show is true
  if (!place || !show) return null;

  const hasAvatars = place.preview_avatars && place.preview_avatars.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).mass(0.8)}
      exiting={FadeOutDown.springify().damping(20).mass(0.8)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: "#000",
        },
      ]}
    >
      {/* Location icon at top - centered */}
      <View style={styles.iconWrapper}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${colors.accent}15` },
          ]}
        >
          <LocationPinIcon size={24} color={colors.accent} />
        </View>
      </View>

      {/* Question text - centered */}
      <View style={styles.textWrapper}>
        <ThemedText
          style={[typography.body1, styles.placeName, { color: colors.text }]}
          numberOfLines={2}
        >
          {t("screens.home.detectionBanner.question", {
            placeName: place.name,
          })}
        </ThemedText>
      </View>

      {/* Avatars row - centered */}
      {hasAvatars && (
        <View style={styles.avatarsRow}>
          <StackedAvatars
            avatars={place.preview_avatars!}
            totalCount={place.active_users ?? place.preview_avatars!.length}
            maxVisible={3}
            size={36}
            borderColor={colors.surface}
          />
        </View>
      )}

      {/* Action buttons - horizontal layout */}
      <View style={styles.actionsRow}>
        <Button
          onPress={handleConnect}
          style={styles.connectButton}
          variant="primary"
          disabled={isConnecting}
          loading={isConnecting}
          label={ctaLabel}
        />

        <Button
          onPress={handleDismiss}
          style={styles.closeButton}
          variant="ghost"
          textStyle={{ color: colors.textSecondary }}
          label={t("screens.home.detectionBanner.close")}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
    padding: spacing.md,
  },
  content: {
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  textContent: {
    flex: 1,
    gap: 2,
  },
  placeName: {
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  connectButton: {
    flex: 1,
    height: 44,
  },
  closeButton: {
    flex: 1,
    height: 44,
  },
});
