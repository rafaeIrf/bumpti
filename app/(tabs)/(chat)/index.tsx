import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ChatListItem } from "@/components/chat/chat-list-item";
import { MatchAvatar } from "@/components/chat/match-avatar";
import { useDatabase } from "@/components/DatabaseProvider";
import { PotentialConnectionsBanner } from "@/components/potential-connections-banner";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useMarkMatchOpened } from "@/hooks/useMarkMatchOpened";
import type Chat from "@/modules/database/models/Chat";
import type Match from "@/modules/database/models/Match";
import { syncDatabase } from "@/modules/database/sync";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { useGetPendingLikesQuery } from "@/modules/pendingLikes/pendingLikesApi";
import { prefetchImages } from "@/utils/image-prefetch";
import { logger } from "@/utils/logger";
import { Database, Q } from "@nozbe/watermelondb";
import { withObservables } from "@nozbe/watermelondb/react";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

/**
 * Chat List Component (inner component that receives reactive data)
 */
function ChatListScreen({
  chats,
  matches,
}: {
  chats: Chat[];
  matches: Match[];
}) {
  const colors = useThemeColors();
  const { profile } = useProfile();
  const { markMatchAsOpened } = useMarkMatchOpened();
  const database = useDatabase();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debug: Log when observables emit new data
  useEffect(() => {
    logger.log("[ChatList] Chats observable emitted:", {
      count: chats.length,
      chats: chats.map((c) => ({
        id: c.id,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
        lastMessageContent: c.lastMessageContent?.substring(0, 30),
      })),
    });
  }, [chats]);

  useEffect(() => {
    logger.log("[ChatList] Matches observable emitted:", {
      count: matches.length,
      matches: matches.map((m) => ({
        id: m.id,
        matchedAt: m.matchedAt,
        chatId: m.chatId,
        firstMessageAt: m.firstMessageAt,
      })),
    });
  }, [matches]);

  // Prefetch all chat and match images when screen loads
  useEffect(() => {
    const allImageUrls: string[] = [];

    // Collect all chat images
    chats.forEach((chat) => {
      if (chat.otherUserPhotoUrl) {
        allImageUrls.push(chat.otherUserPhotoUrl);
      }
    });

    // Collect all match images
    matches.forEach((match) => {
      if (match.otherUserPhotoUrl) {
        allImageUrls.push(match.otherUserPhotoUrl);
      }
    });

    // Prefetch all images in parallel
    if (allImageUrls.length > 0) {
      prefetchImages(allImageUrls);
    }
  }, [chats, matches]);

  // Force full sync to recover any missing data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncDatabase(database, true); // forceFullSync = true
    } catch (error) {
      logger.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [database]);

  const renderMatchItem = useCallback(
    ({ item }: { item: Match }) => {
      // Create summary object for MatchAvatar (mapping from Model to UI props)
      // using properties from the Match model
      const matchSummary = {
        match_id: item.id, // Model uses id
        chat_id: item.chatId,
        matched_at: item.matchedAt?.toISOString() ?? null,
        place_id: item.placeId,
        place_name: item.placeName,
        is_new_match: profile?.id ? item.isNewMatch(profile.id) : false,
        other_user: {
          id: item.otherUserId,
          name: item.otherUserName,
          photo_url: item.otherUserPhotoUrl,
        },
      };

      return (
        <MatchAvatar
          match={matchSummary}
          onPress={async () => {
            // Mark match as opened before navigating
            await markMatchAsOpened(item);

            router.push({
              pathname: "/main/message",
              params: {
                matchId: item.id,
                chatId: item.chatId,
                otherUserId: item.otherUserId,
                name: item.otherUserName ?? undefined,
                photoUrl: item.otherUserPhotoUrl ?? undefined,
                matchPlace: item.placeName ?? undefined,
                matchedAt: item.matchedAt?.toISOString() ?? undefined,
              },
            });
          }}
        />
      );
    },
    [chats, profile?.id, markMatchAsOpened],
  );

  // Sort chats by lastMessageAt in the component (not in query)
  // This ensures observer fires on ANY field change
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const timeA = a.lastMessageAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
      const timeB = b.lastMessageAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
      return timeB - timeA; // desc
    });
  }, [chats]);

  const renderChatItem = useCallback(({ item }: { item: Chat }) => {
    return (
      <ChatListItem
        chat={item}
        onPress={() =>
          router.push({
            pathname: "/main/message",
            params: {
              chatId: item._raw.id,
              matchId: item.matchId,
              name: item.otherUserName || "",
              photoUrl: item.otherUserPhotoUrl || "",
              matchPlace: item.placeName ?? undefined,
              otherUserId: item.otherUserId,
              unreadCount: item.unreadCount ?? undefined,
              lastMessagePreview: item.lastMessageContent ?? undefined,
              matchedAt: item.createdAt?.toISOString() ?? undefined,
            },
          })
        }
      />
    );
  }, []);

  const header = <ScreenToolbar title={t("screens.chat.title")} />;

  const { data: pendingData } = useGetPendingLikesQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: true,
  });

  // Use data?.count directly, assuming API returns { count, users }
  // Adjusted based on typical RTK Query usage; verify if pendingData has count property
  const pendingCount = pendingData?.count ?? 0;
  const pendingUsers = useMemo(() => pendingData?.users ?? [], [pendingData]);
  const pendingPhotos = useMemo(
    () =>
      pendingUsers
        .map((u) => u.photos?.[0])
        .filter((p): p is string => !!p)
        .slice(0, 3),
    [pendingUsers],
  );

  const { isPremium } = useUserSubscription();

  const handleOpenPendingLikes = useCallback(() => {
    if (pendingUsers.length === 0) return;

    if (!isPremium) {
      router.push("/(modals)/premium-paywall");
      return;
    }

    router.push({
      pathname: "/(modals)/place-people",
      params: {
        placeId: "pending-likes",
        placeName: t("screens.chat.potentialConnections.title"),
        initialUsers: JSON.stringify(pendingUsers),
      },
    });
  }, [pendingUsers, isPremium]);

  const showEmptyState = chats.length === 0 && matches.length === 0;

  return (
    <BaseTemplateScreen
      ignoreBottomSafeArea
      TopHeader={header}
      // Disable BaseTemplateScreen scroll to avoid VirtualizedList error
      scrollEnabled={false}
    >
      <ThemedView style={styles.container}>
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item._raw.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {pendingCount > 0 && (
                <PotentialConnectionsBanner
                  count={pendingCount}
                  profilePhotos={pendingPhotos}
                  onPress={handleOpenPendingLikes}
                  style={styles.banner}
                />
              )}
              {matches.length > 0 && (
                <View style={styles.matchesSection}>
                  <FlatList
                    horizontal
                    data={matches}
                    renderItem={renderMatchItem}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.matchesContent}
                  />
                </View>
              )}
              {chats.length > 0 && (
                <ThemedText style={styles.sectionTitle}>
                  {t("screens.chat.messages")}
                </ThemedText>
              )}
            </View>
          }
          ListEmptyComponent={
            showEmptyState ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyTitle}>
                  {t("screens.chat.emptyTitle")}
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  {t("screens.chat.emptySubtitle")}
                </ThemedText>
              </ThemedView>
            ) : null
          }
        />
      </ThemedView>
    </BaseTemplateScreen>
  );
}

// Enhanced component with WatermelonDB reactive queries
// CRITICAL: Use observeWithColumns for sorted lists to detect field changes
const ChatListEnhanced = withObservables(
  [],
  ({ database }: { database: Database }) => ({
    // Observe ONLY chats WITH messages (last_message_content is NOT NULL)
    // This ensures re-render when these fields change, not just when records are added/removed
    chats: database.collections
      .get<Chat>("chats")
      .query(Q.where("last_message_content", Q.notEq(null)))
      .observeWithColumns([
        "last_message_at",
        "unread_count",
        "last_message_content",
        "synced_at",
      ]),
    // Observe ALL matches returned by backend
    // Backend already filters to only return matches without messages (first_message_at = null)
    // Observe ONLY matches WITHOUT messages (first_message_at = null)
    // Backend always returns chat_id (needed to send messages) and first_message_at
    // When first message is sent, sync updates match.first_message_at and it disappears from this list
    matches: database.collections
      .get<Match>("matches")
      .query(Q.where("first_message_at", null), Q.sortBy("matched_at", Q.desc))
      .observeWithColumns([
        "user_a_opened_at",
        "user_b_opened_at",
        "chat_id",
        "first_message_at",
        "synced_at",
      ]),
  }),
)(ChatListScreen);

/**
 * Wrapper that provides database from context
 */
export default function ChatScreenWithDatabase() {
  const database = useDatabase();
  return <ChatListEnhanced database={database} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerContainer: {
    // No padding - BaseTemplateScreen already provides it when scrollEnabled={false}
  },
  banner: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  matchesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subheading,
    marginBottom: spacing.sm,
  },
  matchesContent: {
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.subheading2,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: "center",
  },
});
