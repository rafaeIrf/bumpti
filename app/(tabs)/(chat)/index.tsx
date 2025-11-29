import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ChatSummary,
  MatchSummary,
  Message,
  getChats,
  getMatches,
  getMessages,
  sendMessage,
  subscribeToChatMessages,
} from "@/modules/chats/api";
import { t } from "@/modules/locales";
import { supabase } from "@/modules/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

type ChatListItemProps = {
  chat: ChatSummary;
  onPress: (chat: ChatSummary) => void;
};

type MessageBubbleProps = {
  message: Message;
  isMe: boolean;
};

type MatchAvatarProps = {
  match: MatchSummary;
  onPress?: () => void;
};

export default function ChatScreen() {
  const colors = useThemeColors();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  const loadChats = useCallback(async () => {
    try {
      setLoadingChats(true);
      const [chatData, matchData] = await Promise.all([
        getChats(),
        getMatches(),
      ]);
      setChats(chatData.chats);
      setMatches(matchData.matches);
      if (chatData.chats.length && !selectedChat) {
        setSelectedChat(chatData.chats[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoadingChats(false);
    }
  }, [selectedChat]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      setLoadingMessages(true);
      const data = await getMessages({ chatId });
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChat) return;

    loadMessages(selectedChat.chat_id);

    const unsubscribe = subscribeToChatMessages(
      selectedChat.chat_id,
      (message) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          const next = [...prev, message];
          return next.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
        });
      }
    );

    return () => {
      unsubscribe().catch(() => {});
    };
  }, [selectedChat, loadMessages]);

  useEffect(() => {
    if (!listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedChat || sending) return;
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const response = await sendMessage({
        toUserId: selectedChat.other_user.id,
        content: trimmed,
      });
      setMessages((prev) => {
        const next = [...prev, response.message];
        return next.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedChat, sending]);

  const handleSelectChat = useCallback((chat: ChatSummary) => {
    setSelectedChat(chat);
    setMessages([]);
  }, []);

  const emptyState = useMemo(
    () => chats.length === 0 && !loadingChats,
    [chats, loadingChats]
  );

  const renderChatItem = useCallback(
    ({ item }: { item: ChatSummary }) => (
      <ChatListItem chat={item} onPress={handleSelectChat} />
    ),
    [handleSelectChat]
  );

  const renderMatchItem = useCallback(
    ({ item }: { item: MatchSummary }) => (
      <MatchAvatar
        match={item}
        onPress={() => {
          const existingChat = chats.find((c) => c.match_id === item.match_id);
          if (existingChat) {
            handleSelectChat(existingChat);
          }
        }}
      />
    ),
    [chats, handleSelectChat]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} isMe={item.sender_id === userId} />
    ),
    [userId]
  );

  const header = selectedChat ? (
    <ScreenToolbar
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: () => setSelectedChat(null),
        ariaLabel: t("common.back"),
        color: colors.text,
      }}
      title={selectedChat.other_user?.name ?? t("screens.chat.title")}
    />
  ) : (
    <ScreenToolbar title={t("screens.chat.title")} />
  );

  const content = selectedChat ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? spacing.xl : 0}
    >
      {loadingMessages ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesContainer,
            { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
          ]}
        />
      )}
      <View
        style={[
          styles.inputRow,
          {
            borderTopColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder={t("screens.chat.messagePlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
              paddingHorizontal: spacing.md,
            },
          ]}
          onSubmitEditing={handleSendMessage}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleSendMessage}
          disabled={sending || !newMessage.trim()}
          style={[
            styles.sendButton,
            {
              backgroundColor: !newMessage.trim()
                ? colors.disabledBG
                : colors.accent,
            },
          ]}
        >
          <ThemedText style={{ color: colors.textPrimary }}>➤</ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  ) : (
    <ThemedView style={styles.flex}>
      {loadingChats && (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      {!loadingChats && matches.length > 0 && (
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
          ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
        />
      )}
      {!loadingChats && (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.chat_id}
          renderItem={renderChatItem}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: spacing.sm,
              }}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
          }}
        />
      )}
      {emptyState && (
        <View style={[styles.emptyState, { padding: spacing.lg }]}>
          <ThemedText style={[typography.subheading, { color: colors.text }]}>
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
      )}
    </ThemedView>
  );

  return (
    <BaseTemplateScreen TopHeader={header}>
      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.surface }]}>
          <ThemedText style={[typography.body, { color: colors.text }]}>
            {error}
          </ThemedText>
        </View>
      ) : null}
      {content}
    </BaseTemplateScreen>
  );
}

function ChatListItem({ chat, onPress }: ChatListItemProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => onPress(chat)}
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
        <UserAvatar name={chat.other_user?.name} />
        <View style={styles.chatInfo}>
          <ThemedText style={[typography.body1, { color: colors.text }]}>
            {chat.other_user?.name ?? t("screens.chat.title")}
          </ThemedText>
          <ThemedText
            numberOfLines={1}
            style={[
              typography.body,
              { color: colors.textSecondary, marginTop: spacing.xs },
            ]}
          >
            {chat.last_message?.content ?? t("screens.chat.noMessages")}
          </ThemedText>
        </View>
        <ThemedText
          style={[typography.caption, { color: colors.textSecondary }]}
        >
          {formatTime(chat.last_message?.created_at || chat.matched_at)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function UserAvatar({ name }: { name?: string | null }) {
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
      <ThemedText style={[typography.body1, { color: colors.text }]}>
        {initial}
      </ThemedText>
    </View>
  );
}

function MatchAvatar({ match, onPress }: MatchAvatarProps) {
  const colors = useThemeColors();
  const initial = match.name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <Pressable
      onPress={onPress}
      style={{ alignItems: "center" }}
      accessibilityLabel={match.name ?? "Match"}
    >
      <View
        style={[
          styles.matchAvatar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ThemedText style={[typography.body1, { color: colors.text }]}>
          {initial}
        </ThemedText>
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
        {match.name ?? t("screens.chat.title")}
      </ThemedText>
    </Pressable>
  );
}

function MessageBubble({ message, isMe }: MessageBubbleProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.messageRow,
        { justifyContent: isMe ? "flex-end" : "flex-start" },
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          {
            backgroundColor: isMe ? colors.accent : colors.surface,
            borderColor: isMe ? colors.accent : colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <ThemedText
          style={[
            typography.body,
            { color: isMe ? colors.textPrimary : colors.text },
          ]}
        >
          {message.content}
        </ThemedText>
      </View>
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
  },
  matchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesContainer: {},
  messageRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  messageBubble: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    maxWidth: "80%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    ...typography.body,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
