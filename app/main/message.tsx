import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  ExclamationCircleIcon,
  MapPinIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { ChatActionsBottomSheet } from "@/components/chat-actions-bottom-sheet";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { ReportReasonsBottomSheet } from "@/components/report-reasons-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
  Text,
  TextInput,
  View,
} from "react-native";
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
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const { data: messages = [], isLoading: loading } = useGetMessagesQuery(
    chatId ?? "",
    {
      skip: !chatId,
      refetchOnMountOrArgChange: false,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );
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
    if (!chatId) return;
    const unsub = attachChatRealtime(chatId, dispatch, userId ?? undefined);
    return () => {
      unsub?.().catch(() => {});
    };
  }, [chatId, dispatch, userId]);

  useEffect(() => {
    if (!listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [messages.length]);

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
      await sendMessage({
        chatId,
        toUserId: otherUserId,
        content: trimmed,
        senderId: userId ?? undefined,
      });
      setNewMessage("");
      // Manter foco no input após enviar
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }, [chatId, newMessage, otherUserId, sendMessage, userId]);

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
        messagesApi.util.updateQueryData("getMessages", chatId, (draft) => {
          const idx = draft.findIndex(
            (m) => m.tempId === message.tempId || m.id === message.id
          );
          if (idx >= 0) {
            draft.splice(idx, 1);
          }
        })
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
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMe={Boolean(otherUserId && item.sender_id !== otherUserId)}
              onFailedPress={handleFailedMessagePress}
            />
          )}
          ListHeaderComponent={
            params.matchPlace ? (
              <View style={styles.matchCardContainer}>
                <ThemedView
                  style={[
                    styles.matchCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <View style={styles.matchTitleRow}>
                    <ThemedText
                      style={[
                        typography.body,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      <MapPinIcon
                        width={12}
                        height={12}
                        color={colors.accent}
                      />{" "}
                      <Text>{params.matchPlace}</Text>
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[
                      typography.caption,
                      {
                        color: colors.textSecondary,
                        textAlign: "center",
                        marginTop: spacing.xs,
                      },
                    ]}
                  >
                    {t("screens.chatMessages.connectedHere")}
                  </ThemedText>
                </ThemedView>
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
          onContentSizeChange={() =>
            requestAnimationFrame(() => {
              listRef.current?.scrollToEnd({ animated: false });
            })
          }
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
        buttonSize="md"
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={
            Platform.OS === "ios" ? insets.top + spacing.xl : 0
          }
        >
          <ThemedView style={styles.flex}>{content}</ThemedView>
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
              <ThemedText style={{ color: colors.textPrimary }}>➤</ThemedText>
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
  const isSending = message.status === "sending";
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

        {isMe && isSending && (
          <View style={[styles.statusRowBelow, { alignItems: "flex-end" }]}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: colors.textSecondary },
              ]}
            />
          </View>
        )}

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
  matchCardContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  matchCard: {
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    width: "100%",
  },
  matchTitleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
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
});
