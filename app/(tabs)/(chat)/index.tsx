import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ChatListItem } from "@/components/chat/chat-list-item";
import { MatchAvatar } from "@/components/chat/match-avatar";
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
import { t } from "@/modules/locales";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

export default function ChatScreen() {
  const colors = useThemeColors();
  const { data: chats = [], isLoading: loadingChats } = useGetChatsQuery();
  const { data: matchesData = [], isLoading: loadingMatches } =
    useGetMatchesQuery();
  const matches = matchesData;
  const [isLoading, setIsLoading] = useState(true);
  // Prefetch all user images for better UX
  useEffect(() => {
    if (loadingChats || loadingMatches) return;

    const imageUrls: string[] = [];

    // Collect image URLs from matches (high priority - visible first)
    for (const match of matches) {
      if (match.other_user?.photo_url) {
        imageUrls.push(match.other_user.photo_url);
      }
    }

    // Collect image URLs from chats
    for (const chat of chats) {
      if (chat.other_user?.photo_url) {
        imageUrls.push(chat.other_user.photo_url);
      }
    }

    // Prefetch all images in parallel with cache policy
    if (imageUrls.length > 0) {
      Promise.all(
        imageUrls.map((url) =>
          Image.prefetch(url, { cachePolicy: "memory-disk" })
        )
      )
        .then(() => {
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
          // Silently fail - images will load normally if prefetch fails
        });
    } else {
      setIsLoading(false);
    }
  }, [chats, matches, loadingChats, loadingMatches]);

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
              matchId: item.match_id,
              chatId: item.chat_id,
              otherUserId: item.other_user?.id,
              name: item.other_user?.name ?? undefined,
              photoUrl: item.other_user?.photo_url ?? undefined,
              matchPlace: item.place_name ?? undefined,
              matchedAt: item.chat_created_at ?? undefined,
              unreadMessages: item.unread_count ?? undefined,
              firstMessageAt: item.first_message_at ?? undefined,
            },
          })
        }
      />
    ),
    []
  );

  const handleOpenPaywall = useCallback(() => {
    router.push("/(modals)/premium-paywall");
  }, []);

  const header = <ScreenToolbar title={t("screens.chat.title")} />;

  return (
    <BaseTemplateScreen TopHeader={header} scrollEnabled={false}>
      <ThemedView style={styles.flex}>
        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={chats}
            keyExtractor={(item) => item.chat_id}
            renderItem={renderChatItem}
            ListHeaderComponent={
              <>
                <PotentialConnectionsBanner
                  count={12}
                  onPress={handleOpenPaywall}
                  style={styles.banner}
                />
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
              </>
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: spacing.sm }} />
            )}
            ListEmptyComponent={
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
            }
          />
        )}
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
    marginBottom: spacing.md,
  },
  matchesList: {
    marginTop: spacing.md,
  },
});
