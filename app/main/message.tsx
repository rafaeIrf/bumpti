import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EllipsisVerticalIcon,
  ExclamationCircleIcon,
  SendHorizontalIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { ChatActionsBottomSheet } from "@/components/chat-actions-bottom-sheet";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { LoadingView } from "@/components/loading-view";
import { MatchPlaceCard } from "@/components/match-place-card";
import { ReportReasonsBottomSheet } from "@/components/report-reasons-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { markMessagesRead, updateMatch } from "@/modules/chats/api";
import {
  ChatMessage,
  attachChatRealtime,
  messagesApi,
  useGetMessagesQuery,
  useSendMessageMutation,
} from "@/modules/chats/messagesApi";
import { t } from "@/modules/locales";
import { useAppDispatch } from "@/modules/store/hooks";
import { supabase } from "@/modules/supabase/client";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import Animated, {
  Easing,
  FadeInUp,
  FadeOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Params = {
  chatId?: string;
  matchId?: string;
  name?: string;
  photoUrl?: string;
  matchPlace?: string;
  otherUserId?: string;
  unreadMessages?: string;
};

export default function ChatMessageScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<Params>();
  const bottomSheet = useCustomBottomSheet();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const chatId = params.chatId;
  const matchId = params.matchId;
  const unreadMessages = params.unreadMessages;
  const otherUserId = params.otherUserId;
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [failedMessage, setFailedMessage] = useState<ChatMessage | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const {
    data,
    isLoading: loading,
    refetch,
  } = useGetMessagesQuery(
    { chatId: chatId ?? "", cursor: undefined },
    {
      skip: !chatId,
      refetchOnMountOrArgChange: false,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );
  const messages = data?.messages ?? [];
  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor ?? null;
  const [sendMessage] = useSendMessageMutation();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (params.photoUrl) {
      Image.prefetch(params.photoUrl).catch(() => {});
    }
  }, [params.photoUrl]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!chatId || !userId) return;
    console.log(
      "[Realtime] Attaching realtime for chatId:",
      chatId,
      "userId:",
      userId
    );
    const unsub = attachChatRealtime(chatId, dispatch, userId);
    return () => {
      console.log("[Realtime] Detaching realtime for chatId:", chatId);
      unsub?.().catch(() => {});
    };
  }, [chatId, dispatch, userId]);

  // Com inverted, a lista já mostra mensagens mais recentes no topo
  // Não precisa de scrollToEnd

  useEffect(() => {
    console.log("unreadMessages", unreadMessages);
    if (!chatId || loading || messages.length === 0 || unreadMessages === "0")
      return;
    console.log("chamou");
    // Mark messages as read after they are rendered
    requestAnimationFrame(() => {
      markMessagesRead({ chatId }).catch(() => {});
    });
  }, [chatId, unreadMessages, loading, messages.length]);

  const handleSend = useCallback(async () => {
    if (!chatId || !otherUserId) return;
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    try {
      const sendPromise = sendMessage({
        chatId,
        toUserId: otherUserId,
        content: trimmed,
        senderId: userId ?? undefined,
      });
      // Garantir que a nova mensagem fique visível mesmo se o usuário estiver no meio do scroll
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
      await sendPromise;
      setNewMessage("");
      // Manter foco no input após enviar
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }, [chatId, newMessage, otherUserId, sendMessage, userId]);

  const handleScrollToLatest = useCallback(() => {
    setShowScrollToLatest(false);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const handleUnmatchConfirmed = async () => {
    if (!matchId || !otherUserId) return;

    updateMatch({
      matchId,
      status: "unmatched",
    });
    router.back();
  };

  const openReportReasons = () => {
    if (!bottomSheet) return;
    bottomSheet.close();
    setTimeout(() => {
      bottomSheet.expand({
        content: () => (
          <ReportReasonsBottomSheet
            userName={params.name ?? t("screens.chat.title")}
            onSelectReason={(reason) => {
              bottomSheet.close();
              router.push({
                pathname: "/(modals)/report",
                params: {
                  reason,
                  name: params.name ?? "",
                },
              });
            }}
            onClose={() => bottomSheet.close()}
          />
        ),
      });
    }, 300);
  };

  const openActionsBottomSheet = () => {
    if (!bottomSheet) return;
    bottomSheet.expand({
      content: () => (
        <ChatActionsBottomSheet
          userName={params.name ?? t("screens.chat.title")}
          onUnmatch={() => {
            handleUnmatchConfirmed();
            bottomSheet.close();
          }}
          onBlock={() => {
            bottomSheet.close();
          }}
          onReport={() => {
            openReportReasons();
          }}
          onClose={() => bottomSheet.close()}
        />
      ),
    });
  };

  const handleRetry = useCallback(
    async (message: ChatMessage) => {
      if (!chatId || !otherUserId) return;
      try {
        await sendMessage({
          chatId,
          toUserId: otherUserId,
          content: message.content,
          senderId: userId ?? undefined,
          tempId: message.tempId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.generic"));
      }
    },
    [chatId, otherUserId, sendMessage, userId]
  );

  const handleDeleteMessage = useCallback(
    (message: ChatMessage) => {
      if (!chatId) return;
      // Remove mensagem falhada do cache
      dispatch(
        messagesApi.util.updateQueryData(
          "getMessages",
          { chatId, cursor: undefined },
          (draft) => {
            const idx = draft.messages.findIndex(
              (m) => m.tempId === message.tempId || m.id === message.id
            );
            if (idx >= 0) {
              draft.messages.splice(idx, 1);
            }
          }
        )
      );
    },
    [chatId, dispatch]
  );

  const handleFailedMessagePress = useCallback((message: ChatMessage) => {
    setFailedMessage(message);
  }, []);

  const handleCloseFailedModal = useCallback(() => {
    setFailedMessage(null);
  }, []);

  useEffect(() => {
    console.log("isLoadingMore changed:", isLoadingMore);
  }, [isLoadingMore]);

  const handleLoadMore = useCallback(async () => {
    if (!chatId || !hasMore || !nextCursor || isLoadingMore || loading) {
      return;
    }
    setIsLoadingMore(true);
    try {
      await dispatch(
        messagesApi.endpoints.getMessages.initiate(
          { chatId, cursor: nextCursor },
          { forceRefetch: true }
        )
      ).unwrap();
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, nextCursor, isLoadingMore, loading, dispatch]);

  const header = (
    <ScreenToolbar
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.back"),
        color: colors.text,
      }}
      customTitleView={
        <View style={styles.toolbarTitle}>
          <View style={[styles.avatarWrapper, { borderColor: colors.border }]}>
            {params.photoUrl ? (
              <Image
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
          <ThemedText
            style={[
              typography.body1,
              { color: colors.text, marginLeft: spacing.sm },
            ]}
            numberOfLines={1}
          >
            {params.name ?? t("screens.chat.title")}
          </ThemedText>
        </View>
      }
      rightActions={{
        icon: EllipsisVerticalIcon,
        onClick: openActionsBottomSheet,
        ariaLabel: t("screens.chatMessages.moreActions"),
        color: colors.text,
      }}
    />
  );

  const content = (
    <View style={styles.flex}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.tempId || item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMe={Boolean(otherUserId && item.sender_id !== otherUserId)}
              onFailedPress={handleFailedMessagePress}
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          inverted
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          onScroll={(event) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            setShowScrollToLatest(offsetY > spacing.xxl);
          }}
          scrollEventThrottle={16}
          ListFooterComponent={
            params.matchPlace ? (
              <View>
                <MatchPlaceCard placeName={params.matchPlace} />
                {isLoadingMore && <LoadingView size="small" />}
              </View>
            ) : (
              <View style={{ height: spacing.md }} />
            )
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            rowGap: spacing.sm,
          }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );

  return (
    <>
      <ConfirmationModal
        isOpen={!!failedMessage}
        onClose={handleCloseFailedModal}
        title={t("screens.chatMessages.messageNotSent")}
        actions={[
          {
            label: t("common.resend"),
            onPress: () => {
              if (failedMessage) handleRetry(failedMessage);
              handleCloseFailedModal();
            },
            variant: "default",
          },
          {
            label: t("common.delete"),
            onPress: () => {
              if (failedMessage) handleDeleteMessage(failedMessage);
              handleCloseFailedModal();
            },
            variant: "destructive",
          },
          {
            label: t("common.cancel"),
            onPress: handleCloseFailedModal,
            variant: "secondary",
          },
        ]}
      />
      <BaseTemplateScreen
        TopHeader={header}
        scrollEnabled={false}
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ThemedView style={styles.flex}>
            {content}
            <ScrollToLatestButton
              visible={showScrollToLatest}
              onPress={handleScrollToLatest}
            />
          </ThemedView>
          <View
            style={[
              styles.inputRow,
              {
                borderTopColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                paddingBottom: spacing.sm + insets.bottom,
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
        </KeyboardAvoidingView>
      </BaseTemplateScreen>
    </>
  );
}

function MessageBubble({
  message,
  isMe,
  onFailedPress,
}: {
  message: ChatMessage;
  isMe: boolean;
  onFailedPress: (message: ChatMessage) => void;
}) {
  const colors = useThemeColors();
  const isFailed = message.status === "failed";
  // const isSending = message.status === "sending";
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

        {/* {isMe && isSending && (
          <View style={[styles.statusRowBelow, { alignItems: "flex-end" }]}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: colors.textSecondary },
              ]}
            />
          </View>
        )} */}

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
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
    borderRadius: spacing.lg,
    borderWidth: 1,
  },
  statusRowBelow: {
    flexDirection: "row",
    paddingHorizontal: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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

function ScrollToLatestButton({
  visible,
  onPress,
  bottomInset,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({
          opacity: 0,
          transform: [{ translateY: spacing.xxl }],
        })}
      exiting={FadeOutDown.duration(170)
        .easing(Easing.in(Easing.cubic))
        .withInitialValues({
          opacity: 1,
          transform: [{ translateY: 0 }],
        })}
      style={[
        styles.scrollToLatestButton,
        {
          right: spacing.md,
          bottom: spacing.md,
        },
      ]}
    >
      <Button
        accessibilityLabel={t("screens.chatMessages.scrollToLatest")}
        onPress={onPress}
        variant="secondary"
        size="icon"
      >
        <ArrowRightIcon
          width={18}
          height={18}
          color={colors.textPrimary}
          style={{ transform: [{ rotate: "90deg" }] }}
        />
      </Button>
    </Animated.View>
  );
}
