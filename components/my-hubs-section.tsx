import { ChevronRightIcon, MapPinIcon } from "@/assets/icons";
import { GradientActionCard } from "@/components/gradient-action-card";
import { LoadingView } from "@/components/loading-view";
import { getCategoryColor, getPlaceIcon } from "@/components/place-card-utils";
import { StackedAvatars } from "@/components/stacked-avatars";
import { ThemedText } from "@/components/themed-text";

import { spacing, typography } from "@/constants/theme";
import { usePlaceClick } from "@/hooks/use-place-click";
import { t } from "@/modules/locales";
import { getCardGradientColors } from "@/utils/card-gradient";
import { toTitleCase } from "@/utils/string";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Sortable from "react-native-sortables";

export interface SocialHub {
  id: string;
  name: string;
  category: string;
  visible?: boolean;
  avatars?: { user_id: string; url: string }[];
}

interface SortableHubItem {
  key: string;
  hub: SocialHub;
}

interface MyHubCardProps {
  hub: SocialHub;
}

/** Single hub card — uses GradientActionCard with avatars */
const MyHubCardComponent = memo(function MyHubCard({ hub }: MyHubCardProps) {
  const { handlePlaceClick } = usePlaceClick();
  const [isLoading, setIsLoading] = useState(false);

  const catColor = getCategoryColor(hub.category);
  const CatIcon = getPlaceIcon(hub.category);
  const avatars = hub.avatars ?? [];
  const gradientColors = getCardGradientColors(catColor);

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
    <GradientActionCard
      title={toTitleCase(hub.name)}
      gradientColors={gradientColors}
      gradientLocations={[0, 0.5, 1]}
      icon={CatIcon}
      iconSize={24}
      iconOverride={
        isLoading ? (
          <LoadingView style={styles.loadingBg} color="#FFFFFF" size="small" />
        ) : undefined
      }
      showChevron
      shadowColor="#000"
      disabled={isLoading}
      onPress={handlePress}
    >
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
    </GradientActionCard>
  );
});

// -- Section --

interface MyHubsSectionProps {
  hubs: SocialHub[];
  onAddHubs?: () => void;
  onReorder?: (orderedIds: string[]) => void;
}

function MyHubsSectionComponent({
  hubs,
  onAddHubs,
  onReorder,
}: MyHubsSectionProps) {
  const visibleHubs = useMemo(
    () => hubs.filter((h) => h.visible !== false),
    [hubs],
  );

  const sortableData = useMemo<SortableHubItem[]>(
    () => visibleHubs.map((hub) => ({ key: hub.id, hub })),
    [visibleHubs],
  );

  const handleDragStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: SortableHubItem[] }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const orderedIds = data.map((item) => item.hub.id);
      onReorder?.(orderedIds);
    },
    [onReorder],
  );

  const renderHubItem = useCallback(
    ({ item }: { item: SortableHubItem }) => (
      <MyHubCardComponent hub={item.hub} />
    ),
    [],
  );

  const MAX_HUBS = 6;
  const canAddMore = visibleHubs.length < MAX_HUBS;
  const isEmpty = visibleHubs.length === 0;

  if (isEmpty && canAddMore) {
    if (!onAddHubs) return null;
    return (
      <Pressable onPress={onAddHubs} style={styles.emptyCard}>
        <View style={styles.emptyIconCircle}>
          <MapPinIcon width={22} height={22} color="rgba(255,255,255,0.7)" />
        </View>
        <ThemedText style={styles.emptyText}>
          {t("screens.home.myHubs.addHubsEmpty")}
        </ThemedText>
        <ChevronRightIcon width={24} height={24} color="#FFFFFF" />
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      <Sortable.Grid
        columns={1}
        data={sortableData}
        renderItem={renderHubItem}
        rowGap={spacing.smd}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
      {canAddMore && onAddHubs && (
        <Pressable onPress={onAddHubs} style={styles.addMoreCard}>
          <View style={styles.emptyIconCircle}>
            <MapPinIcon width={22} height={22} color="rgba(255,255,255,0.7)" />
          </View>
          <ThemedText style={styles.emptyText}>
            {t("screens.home.myHubs.addHubsMore")}
          </ThemedText>
          <ChevronRightIcon width={24} height={24} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

export const MyHubsSection = memo(MyHubsSectionComponent);

const styles = StyleSheet.create({
  section: {
    gap: spacing.smd,
  },
  loadingBg: {
    backgroundColor: "transparent",
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
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: spacing.sm,
  },
  addMoreCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
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
