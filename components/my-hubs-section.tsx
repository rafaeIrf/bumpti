import { MapPinIcon } from "@/assets/icons";
import { LoadingView } from "@/components/loading-view";
import { getCategoryColor, getPlaceIcon } from "@/components/place-card-utils";
import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography } from "@/constants/theme";
import { usePlaceClick } from "@/hooks/use-place-click";
import { t } from "@/modules/locales";
import { getCardGradientColors } from "@/utils/card-gradient";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface SocialHub {
  id: string;
  name: string;
  category: string;
  visible?: boolean;
  avatars?: { user_id: string; url: string }[];
}

interface MyHubCardProps {
  hub: SocialHub;
}

/** Single hub card — mirrors MyCampusCard design with category-specific color */
const MyHubCardComponent = memo(function MyHubCard({ hub }: MyHubCardProps) {
  const { handlePlaceClick } = usePlaceClick();
  const [isLoading, setIsLoading] = useState(false);

  const catColor = getCategoryColor(hub.category);
  const CatIcon = getPlaceIcon(hub.category);
  const avatars = hub.avatars ?? [];

  // GPU-only press animation (transform only)
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(async () => {
    try {
      setIsLoading(true);
      await handlePlaceClick({
        placeId: hub.id,
        name: hub.name,
        latitude: 0,
        longitude: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [hub.id, hub.name, handlePlaceClick]);

  return (
    <Animated.View style={[styles.cardContainer, cardStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withSpring(0.98);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        disabled={isLoading}
      >
        <LinearGradient
          colors={getCardGradientColors(catColor)}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.row}
        >
          {/* Left: category icon */}
          <View style={styles.iconCircle}>
            {isLoading ? (
              <LoadingView
                style={styles.loadingBg}
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <CatIcon width={24} height={24} color="#FFFFFF" />
            )}
          </View>

          {/* Center: name + avatars/label */}
          <View style={styles.content}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {hub.name.toUpperCase()}
            </ThemedText>
            {avatars.length > 0 ? (
              <StackedAvatars
                style={styles.avatars}
                avatarStyle={styles.avatarBorder}
                avatars={avatars}
                size={24}
                totalCount={avatars.length}
                maxVisible={4}
              />
            ) : (
              <View style={styles.statusRow}>
                <ThemedText style={styles.statusText} numberOfLines={1}>
                  {t("screens.home.myHubs.tapToConnect")}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Right: chevron */}
          <IconSymbol
            name="chevron.right"
            size={16}
            color="rgba(255,255,255,0.5)"
          />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
});

// -- Section --

interface MyHubsSectionProps {
  hubs: SocialHub[];
  onAddHubs?: () => void;
}

function MyHubsSectionComponent({ hubs, onAddHubs }: MyHubsSectionProps) {
  const visibleHubs = hubs.filter((h) => h.visible !== false);

  if (visibleHubs.length === 0) {
    if (!onAddHubs) return null;

    return (
      <Pressable onPress={onAddHubs} style={styles.emptyCard}>
        <View style={styles.emptyIconCircle}>
          <MapPinIcon width={22} height={22} color="rgba(255,255,255,0.7)" />
        </View>
        <ThemedText style={styles.emptyText}>
          {t("screens.home.myHubs.addHubs")}
        </ThemedText>
        <IconSymbol
          name="chevron.right"
          size={16}
          color="rgba(255,255,255,0.4)"
        />
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      {visibleHubs.map((hub) => (
        <MyHubCardComponent key={hub.id} hub={hub} />
      ))}
    </View>
  );
}

export const MyHubsSection = memo(MyHubsSectionComponent);

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  loadingBg: {
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.captionBold,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusText: {
    ...typography.caption,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  avatars: {
    marginTop: spacing.xs,
  },
  avatarBorder: {
    borderColor: "#FFFFFF",
    borderWidth: 0.5,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...typography.caption,
    color: "rgba(255,255,255,0.5)",
    flex: 1,
  },
});
