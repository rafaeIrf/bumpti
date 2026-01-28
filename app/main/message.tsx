import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  ExclamationCircleIcon,
  MapPinIcon,
  SendHorizontalIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { ChatActionsBottomSheet } from "@/components/chat-actions-bottom-sheet";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { MatchPlaceCard } from "@/components/match-place-card";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useUserActions } from "@/hooks/use-user-actions";
import { t } from "@/modules/locales";
import { prefetchImages } from "@/utils/image-prefetch";
import { logger } from "@/utils/logger";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// WatermelonDB
import { useDatabase } from "@/components/DatabaseProvider";
import { useProfile } from "@/hooks/use-profile";
import { useMarkMessagesRead } from "@/hooks/useMarkMessagesRead";
import { useMessagePagination } from "@/hooks/useMessagePagination";
import { useSendMessage } from "@/hooks/useSendMessage";
import Message from "@/modules/database/models/Message";
import { preloadProfile } from "@/modules/profile/cache";
import { Database, Q } from "@nozbe/watermelondb";
import { withObservables } from "@nozbe/watermelondb/react";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

type Params = {
  chatId?: string;
  matchId?: string;
  name?: string;
  photoUrl?: string;
  matchPlace?: string;
  matchedAt?: string;
  otherUserId?: string;
  unreadMessages?: string;
  firstMessageAt?: string;
};

// --- Inner Component (Reactive) ---

interface ChatMessageListProps {
  messages: Message[];
  chatId: string;
  otherUserId?: string;
  onLoadMore: () => void;
  hasMore: boolean;
  params: Params;
  database: Database;
}

function ChatMessageList({
  messages,
  chatId,
  otherUserId,
  onLoadMore,
  hasMore,
  params,
  database,
}: ChatMessageListProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomSheet = useCustomBottomSheet();
  const { height } = useReanimatedKeyboardAnimation();

  const fakeView = useAnimatedStyle(() => {
    // When keyboard is closed (height = 0), use safe area bottom
    // When keyboard is open, use keyboard height (which includes safe area)
    const keyboardHeight = Math.abs(height.value);
    return {
      height: keyboardHeight > 0 ? keyboardHeight + spacing.sm : insets.bottom,
    };
  });

  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<Message | null>(null);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  const listRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);

  // Get current user ID from profile hook (faster than async call)
  const { profile } = useProfile();
  const userId = profile?.id || null;

  // Hooks
  const { sendMessage, isSending } = useSendMessage(chatId, userId || "");
  const {
    handleReport,
    handleBlock,
    confirmBlock,
    handleUnmatch,
    confirmUnmatch,
    isBlocking,
    isUnmatching,
    showBlockModal,
    setShowBlockModal,
    showUnmatchModal,
    setShowUnmatchModal,
  } = useUserActions({
    userId: otherUserId,
    userName: params.name,
    matchId: params.matchId,
  });

  const { markMessagesAsRead } = useMarkMessagesRead();

  // Mark messages as read when entering chat
  useEffect(() => {
    if (!messages.length || !userId) return;
    markMessagesAsRead({ chatId, messages, userId });
  }, [messages, userId, chatId, markMessagesAsRead]);

  // Pre-carregar perfil do outro usuário em background quando chat abre
  useEffect(() => {
    if (otherUserId) {
      logger.log(
        `[ChatMessageList] Preloading profile for other user: ${otherUserId}`,
      );
      preloadProfile(otherUserId);
    }
  }, [otherUserId]);

  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    try {
      const sendPromise = sendMessage(trimmed);

      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });

      setNewMessage("");
      // Keep focus
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });

      await sendPromise;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }, [newMessage, sendMessage]);

  const handleRetry = useCallback(
    async (message: Message) => {
      try {
        await sendMessage(message.content);
        // Delete the failed one
        await database.write(async () => {
          await message.markAsDeleted();
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.generic"));
      }
    },
    [sendMessage, database],
  );

  const handleDeleteMessage = useCallback(
    async (message: Message) => {
      try {
        await database.write(async () => {
          await message.markAsDeleted();
        });
      } catch (error) {
        logger.error("Failed to delete message", error);
      }
    },
    [database],
  );

  const openActionsBottomSheet = () => {
    if (!bottomSheet) return;
    bottomSheet.expand({
      content: () => (
        <ChatActionsBottomSheet
          userName={params.name ?? t("screens.chat.title")}
          onUnmatch={handleUnmatch}
          onBlock={handleBlock}
          onReport={() => {
            bottomSheet.close();
            handleReport();
          }}
          onClose={() => bottomSheet.close()}
        />
      ),
    });
  };

  const header = (
    <ScreenToolbar
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.back"),
        color: colors.text,
      }}
      customTitleView={
        <Pressable
          style={styles.toolbarTitle}
          onPress={() => {
            if (otherUserId) {
              router.push({
                pathname: "/(modals)/profile-preview",
                params: {
                  userId: otherUserId,
                },
              });
            }
          }}
        >
          <View style={[styles.avatarWrapper, { borderColor: colors.border }]}>
            {params.photoUrl ? (
              <RemoteImage
                source={{ uri: params.photoUrl }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <ThemedText style={[typography.body1, { color: colors.text }]}>
                {params.name?.[0]?.toUpperCase() ?? "?"}
              </ThemedText>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <ThemedText
              style={[typography.body1, { color: colors.text }]}
              numberOfLines={1}
            >
              {params.name ?? t("screens.chat.title")}
            </ThemedText>
            {params.matchPlace && (
              <View style={styles.toolbarPlaceRow}>
                <MapPinIcon width={12} height={12} color={colors.accent} />
                <ThemedText
                  style={[
                    typography.caption,
                    {
                      color: colors.textSecondary,
                      marginLeft: spacing.xs / 2,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {params.matchPlace}
                </ThemedText>
              </View>
            )}
          </View>
        </Pressable>
      }
      rightActions={{
        icon: EllipsisVerticalIcon,
        onClick: openActionsBottomSheet,
        ariaLabel: t("screens.chatMessages.moreActions"),
        color: colors.text,
      }}
    />
  );

  return (
    <>
      <ConfirmationModal
        isOpen={showUnmatchModal}
        onClose={() => setShowUnmatchModal(false)}
        title={t("modals.chatActions.unmatchTitle")}
        description={t("modals.chatActions.unmatchDescription")}
        actions={[
          {
            label: t("modals.chatActions.unmatchConfirm"),
            onPress: confirmUnmatch,
            variant: "destructive",
            loading: isUnmatching,
            disabled: isUnmatching,
          },
          {
            label: t("common.cancel"),
            onPress: () => setShowUnmatchModal(false),
            variant: "secondary",
            disabled: isUnmatching,
          },
        ]}
      />
      <ConfirmationModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={t("modals.chatActions.blockTitle", { name: params.name ?? "" })}
        description={t("modals.chatActions.blockDescription", {
          name: params.name ?? "",
        })}
        actions={[
          {
            label: t("modals.chatActions.blockConfirm", {
              name: params.name ?? "",
            }),
            onPress: confirmBlock,
            variant: "destructive",
            loading: isBlocking,
            disabled: isBlocking,
          },
          {
            label: t("common.cancel"),
            onPress: () => setShowBlockModal(false),
            variant: "secondary",
            disabled: isBlocking,
          },
        ]}
      />
      <ConfirmationModal
        isOpen={!!failedMessage}
        onClose={() => setFailedMessage(null)}
        title={t("screens.chatMessages.messageNotSent")}
        actions={[
          {
            label: t("common.resend"),
            onPress: () => {
              if (failedMessage) handleRetry(failedMessage);
              setFailedMessage(null);
            },
            variant: "default",
          },
          {
            label: t("common.delete"),
            onPress: () => {
              if (failedMessage) handleDeleteMessage(failedMessage);
              setFailedMessage(null);
            },
            variant: "destructive",
          },
          {
            label: t("common.cancel"),
            onPress: () => setFailedMessage(null),
            variant: "secondary",
          },
        ]}
      />

      <BaseTemplateScreen
        TopHeader={header}
        scrollEnabled={false}
        useKeyboardAvoidingView={false}
        ignoreBottomSafeArea
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 0,
          paddingBottom: 0,
        }}
      >
        {error ? (
          <View
            style={[styles.errorBanner, { backgroundColor: colors.surface }]}
          >
            <ThemedText style={[typography.body, { color: colors.text }]}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          <ThemedView style={styles.flex}>
            <FlatList
              ref={listRef}
              data={messages} // Watermelon puts recent last by query, but we invert list
              // Wait, query is sorted by created_at DESC (recent first)
              // If we use inverted=true, recent is at bottom of visual list if data[0] is recent??
              // Inverted FlatList: data[0] is at bottom.
              // We query `Q.sortBy('created_at', Q.desc)`, so data[0] is MOST RECENT.
              // So with `inverted`, data[0] (most recent) is at BOTTOM. Correct.
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isMe={Boolean(userId && item.senderId === userId)}
                  onFailedPress={setFailedMessage}
                />
              )}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.5}
              inverted
              keyboardDismissMode="interactive"
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                setShowScrollToLatest(offsetY > spacing.xxl);
              }}
              scrollEventThrottle={16}
              ListFooterComponent={
                <View>
                  {messages.length === 0 && params.matchPlace && (
                    <Animated.View
                      entering={FadeInUp.duration(400)}
                      exiting={FadeOutDown.duration(500).easing(
                        Easing.out(Easing.cubic),
                      )}
                    >
                      <MatchPlaceCard
                        placeName={params.matchPlace}
                        matchedAt={params.matchedAt}
                        photoUrl={params.photoUrl}
                      />
                    </Animated.View>
                  )}
                  <View style={{ height: spacing.md }} />
                </View>
              }
              contentContainerStyle={{
                paddingVertical: spacing.md,
                rowGap: spacing.sm,
              }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            />
            {/* Scroll Button */}
            {showScrollToLatest && (
              <Pressable
                style={[
                  styles.scrollToLatestButton,
                  {
                    bottom: spacing.md,
                    right: spacing.md,
                    backgroundColor: colors.surface,
                    padding: spacing.sm,
                    borderRadius: 20,
                    elevation: 5,
                    shadowColor: "#000",
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  },
                ]}
                onPress={() => {
                  listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                  });
                }}
              >
                <ArrowLeftIcon
                  width={20}
                  height={20}
                  color={colors.text}
                  style={{ transform: [{ rotate: "-90deg" }] }}
                />
              </Pressable>
            )}
          </ThemedView>
        </View>

        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: colors.border,
              paddingVertical: spacing.sm,
              backgroundColor: colors.background,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
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
                paddingTop: spacing.sm + 2,
                paddingBottom: spacing.sm + 2,
              },
            ]}
            multiline
            numberOfLines={6}
            maxLength={500}
            blurOnSubmit={false}
            textAlignVertical="center"
          />
          <Pressable
            onPress={handleSend}
            disabled={!newMessage.trim()}
            style={[
              styles.sendButton,
              {
                backgroundColor: !newMessage.trim()
                  ? colors.disabledBG
                  : colors.accent,
              },
            ]}
          >
            <SendHorizontalIcon
              width={20}
              height={20}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>
        <Animated.View style={fakeView} />
      </BaseTemplateScreen>
    </>
  );
}

const EnhancedMessageList = withObservables(
  ["chatId", "limit"],
  ({ database, chatId, limit }: any) => ({
    messages: database.collections
      .get("messages")
      .query(
        Q.where("chat_id", chatId),
        Q.sortBy("created_at", Q.desc),
        Q.take(limit),
      )
      .observeWithColumns(["status"]),
  }),
)(ChatMessageList);

// --- Wrapper Component ---

export default function ChatMessageScreenWrapper() {
  const params = useLocalSearchParams<Params>();
  const database = useDatabase();
  const chatId = params.chatId;

  const { limit, loadMore, hasMore } = useMessagePagination();

  // Note: Realtime updates are handled globally by ChatRealtimeProvider
  // No need to subscribe to individual chats

  // Prefetch images
  useEffect(() => {
    if (params.photoUrl) {
      prefetchImages([params.photoUrl]);
    }
  }, [params.photoUrl]);

  if (!chatId) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <EnhancedMessageList
      database={database}
      chatId={chatId}
      limit={limit}
      onLoadMore={loadMore}
      hasMore={hasMore}
      params={params}
      otherUserId={params.otherUserId}
    />
  );
}

// --- Sub-components ---

function MessageBubble({
  message,
  isMe,
  onFailedPress,
}: {
  message: Message;
  isMe: boolean;
  onFailedPress: (message: Message) => void;
}) {
  const colors = useThemeColors();
  const isFailed = message.status === "failed";
  const bubbleColor = isMe ? colors.accent : colors.surface;
  const borderColor = isMe ? colors.accent : colors.border;
  const textColor = isMe ? colors.textPrimary : colors.text;

  return (
    <View
      style={[
        styles.messageRow,
        { justifyContent: isMe ? "flex-end" : "flex-start" },
      ]}
    >
      <View style={{ gap: spacing.xs, maxWidth: "85%" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Pressable
            disabled={!isFailed}
            onPress={() => isFailed && onFailedPress(message)}
            style={[
              styles.messageBubble,
              {
                backgroundColor: bubbleColor,
                borderColor: borderColor,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                maxWidth: isFailed ? "90%" : "100%",
                borderTopRightRadius: isMe ? spacing.sm : spacing.md,
                borderTopLeftRadius: isMe ? spacing.md : spacing.sm,
                borderBottomRightRadius: isMe ? spacing.md : spacing.sm,
                borderBottomLeftRadius: isMe ? spacing.sm : spacing.md,
              },
            ]}
          >
            <ThemedText style={[typography.body, { color: textColor }]}>
              {message.content}
            </ThemedText>
          </Pressable>
          {isFailed && (
            <Pressable onPress={() => onFailedPress(message)} hitSlop={8}>
              <ExclamationCircleIcon
                width={18}
                height={18}
                color={colors.error}
              />
            </Pressable>
          )}
        </View>

        {isMe && isFailed && (
          <View style={[styles.statusRowBelow, { alignItems: "flex-end" }]}>
            <ThemedText
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {t("screens.chatMessages.notSent")}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
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
  toolbarTitle: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toolbarPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs / 2,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  messageRow: {
    flexDirection: "row",
  },
  messageBubble: {
    borderTopRightRadius: spacing.lg,
    borderBottomRightRadius: spacing.lg,
    borderTopLeftRadius: spacing.lg,
    borderBottomLeftRadius: spacing.lg,
    borderWidth: 1,
  },
  statusRowBelow: {
    flexDirection: "row",
    paddingHorizontal: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: spacing.md,
    borderWidth: 1,
    ...typography.body,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scrollToLatestButton: {
    position: "absolute",
    zIndex: 1,
  },
});
