import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ChatListItem } from "@/components/chat/chat-list-item";
import { MatchAvatar } from "@/components/chat/match-avatar";
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
import { router } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

export default function ChatScreen() {
  const colors = useThemeColors();
  const { data: chats = [], isLoading: loadingChats } = useGetChatsQuery();
  const { data: matchesData = [], isLoading: loadingMatches } =
    useGetMatchesQuery();
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
              unreadMessages: item.unread_count ?? undefined,
            },
          })
        }
      />
    ),
    []
  );

  const header = <ScreenToolbar title={t("screens.chat.title")} />;

  return (
    <BaseTemplateScreen TopHeader={header}>
      <ThemedView style={styles.flex}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.chat_id}
          renderItem={renderChatItem}
          ListHeaderComponent={
            <View>
              {(loadingChats || loadingMatches) && (
                <View style={styles.loader}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
              {!loadingMatches && matches.length > 0 && (
                <FlatList
                  data={matches}
                  keyExtractor={(item) => item.match_id}
                  renderItem={renderMatchItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  ItemSeparatorComponent={() => (
                    <View style={{ width: spacing.sm }} />
                  )}
                />
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loadingChats && !loadingMatches ? (
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
            ) : null
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
});
