import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ChatSummary,
  MatchSummary,
  useGetChatsQuery,
  useGetMatchesQuery,
} from "@/modules/chats/messagesApi";
import { t } from "@/modules/locales";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

type ChatListItemProps = {
  chat: ChatSummary;
  onPress: () => void;
};

type MatchAvatarProps = {
  match: MatchSummary;
  onPress: () => void;
};

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
          const chatId =
            item.chat_id ??
            chats.find((c) => c.match_id === item.match_id)?.chat_id ??
            null;
          if (!chatId) return;
          router.push({
            pathname: "/main/message",
            params: {
              chatId,
              otherUserId: item.other_user.id,
              name: item.other_user.name ?? undefined,
              photoUrl: item.other_user.photo_url ?? undefined,
              matchPlace: item.place_id ?? undefined,
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
              otherUserId: item.other_user?.id,
              name: item.other_user?.name ?? undefined,
              photoUrl: item.other_user?.photo_url ?? undefined,
              matchPlace: item.place_id ?? undefined,
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
                  contentContainerStyle={{
                    paddingHorizontal: spacing.md,
                    paddingTop: spacing.md,
                    paddingBottom: spacing.sm,
                  }}
                  ItemSeparatorComponent={() => (
                    <View style={{ width: spacing.sm }} />
                  )}
                />
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            flexGrow: 1,
          }}
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

function ChatListItem({ chat, onPress }: ChatListItemProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chatCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.chatRow}>
        <UserAvatar
          name={chat.other_user?.name}
          photoUrl={chat.other_user?.photo_url ?? undefined}
        />
        <View style={styles.chatInfo}>
          <ThemedText style={[typography.body1, { color: colors.text }]}>
            {chat.other_user?.name ?? t("screens.chat.title")}
          </ThemedText>
          {chat.last_message ? (
            <ThemedText
              numberOfLines={1}
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.xs },
              ]}
            >
              {chat.last_message}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          style={[typography.caption, { color: colors.textSecondary }]}
        >
          {formatTime(chat.last_message_at || chat.chat_created_at)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function MatchAvatar({ match, onPress }: MatchAvatarProps) {
  const colors = useThemeColors();
  const initial = match.other_user?.name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <Pressable
      style={{ alignItems: "center" }}
      accessibilityLabel={match.other_user?.name ?? "Match"}
      onPress={onPress}
    >
      <View
        style={[
          styles.matchAvatar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {match.other_user?.photo_url ? (
          <Image
            source={{ uri: match.other_user.photo_url }}
            style={styles.matchAvatarImage}
            contentFit="cover"
          />
        ) : (
          <ThemedText style={[typography.body1, { color: colors.text }]}>
            {initial}
          </ThemedText>
        )}
      </View>
      <ThemedText
        numberOfLines={1}
        style={[
          typography.caption,
          {
            color: colors.text,
            marginTop: spacing.xs,
            maxWidth: 64,
          },
        ]}
      >
        {match.other_user?.name ?? t("screens.chat.title")}
      </ThemedText>
    </Pressable>
  );
}

function UserAvatar({
  name,
  photoUrl,
}: {
  name?: string | null;
  photoUrl?: string | null;
}) {
  const colors = useThemeColors();
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={[
        styles.avatarWrapper,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={styles.avatarImage}
          contentFit="cover"
        />
      ) : (
        <ThemedText style={[typography.body1, { color: colors.text }]}>
          {initial}
        </ThemedText>
      )}
    </View>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return t("screens.chat.time.now");
  if (diffMinutes < 60)
    return t("screens.chat.time.minutes", { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t("screens.chat.time.hours", { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t("screens.chat.time.yesterday");
  return date.toLocaleDateString("pt-BR");
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  chatCard: {
    borderWidth: 1,
    borderRadius: spacing.lg,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  matchAvatarImage: {
    width: "100%",
    height: "100%",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
});
