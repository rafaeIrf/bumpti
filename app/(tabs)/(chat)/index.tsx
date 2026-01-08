import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ChatListItem } from "@/components/chat/chat-list-item";
import { MatchAvatar } from "@/components/chat/match-avatar";
import { LoadingView } from "@/components/loading-view";
import { PotentialConnectionsBanner } from "@/components/potential-connections-banner";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { updateMatch } from "@/modules/chats/api";
import {
  ChatSummary,
  MatchSummary,
  useGetChatsQuery,
  useGetMatchesQuery,
} from "@/modules/chats/messagesApi";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { useGetPendingLikesQuery } from "@/modules/pendingLikes/pendingLikesApi";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

export default function ChatScreen() {
  const colors = useThemeColors();
  const { data: chats = [], isLoading: loadingChats } = useGetChatsQuery();
  const { data: matchesData = [] } = useGetMatchesQuery();
  const matches = matchesData;

  const renderMatchItem = useCallback(
    ({ item }: { item: MatchSummary }) => (
      <MatchAvatar
        match={item}
        onPress={() => {
          if (item.is_new_match) {
            updateMatch({
              matchId: item.match_id,
              markOpened: true,
            });
          }
          const chatId =
            item.chat_id ??
            chats.find((c) => c.match_id === item.match_id)?.chat_id ??
            null;
          if (!chatId) return;
          router.push({
            pathname: "/main/message",
            params: {
              matchId: item.match_id,
              chatId,
              otherUserId: item.other_user.id,
              name: item.other_user.name ?? undefined,
              photoUrl: item.other_user.photo_url ?? undefined,
              matchPlace: item.place_name ?? undefined,
              matchedAt: item.matched_at ?? undefined,
            },
          });
        }}
      />
    ),
    [chats]
  );

  const renderChatItem = useCallback(
    ({ item }: { item: ChatSummary }) => (
      <ChatListItem
        chat={item}
        onPress={() =>
          router.push({
            pathname: "/main/message",
            params: {
              chatId: item.chat_id,
              matchId: item.match_id,
              name: item.other_user.name,
              photoUrl: item.other_user.photo_url,
              matchPlace: item.place_name ?? undefined,
              otherUserId: item.other_user.id,
              unreadCount: item.unread_count ?? undefined,
              lastMessagePreview: item.last_message,
              matchedAt: item.chat_created_at ?? undefined,
              firstMessageAt: item.first_message_at ?? undefined,
              unreadMessages: item.unread_count ?? undefined,
            },
          })
        }
      />
    ),
    []
  );

  const header = <ScreenToolbar title={t("screens.chat.title")} />;

  const { data: pendingData, isLoading: loadingPending } =
    useGetPendingLikesQuery(undefined, {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    });
  const pendingCount = pendingData?.count ?? 0;
  const pendingUsers = useMemo(() => pendingData?.users ?? [], [pendingData]);
  const pendingPhotos = useMemo(
    () =>
      pendingUsers
        .map((u) => u.photos?.[0])
        .filter((p): p is string => !!p)
        .slice(0, 3),
    [pendingUsers]
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

  return (
    <BaseTemplateScreen TopHeader={header} scrollEnabled={false}>
      <ThemedView style={styles.flex}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.chat_id}
          renderItem={renderChatItem}
          ListHeaderComponent={
            <>
              {!loadingPending &&
              pendingCount > 0 &&
              pendingPhotos.length > 0 ? (
                <PotentialConnectionsBanner
                  count={pendingCount}
                  profilePhotos={pendingPhotos}
                  onPress={handleOpenPendingLikes}
                  style={styles.banner}
                />
              ) : null}

              {matches.length > 0 ? (
                <FlatList
                  data={matches}
                  keyExtractor={(item) => item.match_id}
                  renderItem={renderMatchItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  ItemSeparatorComponent={() => (
                    <View style={{ width: spacing.sm }} />
                  )}
                  style={styles.matchesList}
                />
              ) : null}

              {chats.length > 0 && (
                <ThemedText style={styles.sectionTitle}>
                  {t("screens.chat.conversationsSection")}
                </ThemedText>
              )}
            </>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            loadingChats ? (
              <LoadingView />
            ) : (
              <View style={[styles.emptyState, { padding: spacing.lg }]}>
                <ThemedText
                  style={[typography.subheading, { color: colors.text }]}
                >
                  {t("screens.chat.emptyTitle")}
                </ThemedText>
                <ThemedText
                  style={[
                    typography.body,
                    {
                      color: colors.textSecondary,
                      textAlign: "center",
                      marginTop: spacing.sm,
                    },
                  ]}
                >
                  {t("screens.chat.emptySubtitle")}
                </ThemedText>
              </View>
            )
          }
        />
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    marginBottom: 0, // Remove margin bottom from banner, control via matchesList marginTop if needed, or keep small
  },
  matchesList: {
    marginTop: spacing.md, // Reduced from lg to md to bring closer to banner
    marginBottom: spacing.sm, // Add space between matches and chat list
  },
  sectionTitle: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
});
