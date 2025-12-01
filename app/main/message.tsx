import { ArrowLeftIcon, EllipsisVerticalIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { ChatActionsBottomSheet } from "@/components/chat-actions-bottom-sheet";
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
  const listRef = useRef<FlatList<ChatMessage>>(null);
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
              onRetry={handleRetry}
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
                      style={[typography.body, { color: colors.text }]}
                    >
                      🔥 {params.matchPlace}
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
        <View style={[styles.errorBanner, { backgroundColor: colors.surface }]}>
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
            onSubmitEditing={handleSend}
            returnKeyType="send"
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
  );
}

function MessageBubble({
  message,
  isMe,
  onRetry,
}: {
  message: ChatMessage;
  isMe: boolean;
  onRetry: (message: ChatMessage) => void;
}) {
  const colors = useThemeColors();
  const showStatus = isMe && message.status;
  const isFailed = message.status === "failed";
  const bubbleColor = isMe ? colors.accent : colors.surface;
  const borderColor = isMe ? colors.accent : colors.border;
  const textColor = isFailed
    ? colors.error
    : isMe
    ? colors.textPrimary
    : colors.text;
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
            backgroundColor: bubbleColor,
            borderColor: borderColor,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <ThemedText style={[typography.body, { color: textColor }]}>
          {message.content}
        </ThemedText>
        {showStatus ? (
          <View style={styles.statusRow}>
            {message.status === "sending" && (
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: colors.textSecondary },
                ]}
              />
            )}
            {message.status === "failed" && (
              <Pressable onPress={() => onRetry(message)}>
                <ThemedText
                  style={[
                    typography.caption,
                    {
                      color: colors.error,
                      marginLeft: spacing.xs,
                      textDecorationLine: "underline",
                    },
                  ]}
                >
                  {t("common.retry")}
                </ThemedText>
              </Pressable>
            )}
          </View>
        ) : null}
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
    columnGap: spacing.xs,
  },
  messageRow: {
    flexDirection: "row",
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
    columnGap: spacing.sm,
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
  },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
