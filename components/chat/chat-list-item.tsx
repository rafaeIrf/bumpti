import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { ChatSummary } from "@/modules/chats/messagesApi";
import { t } from "@/modules/locales";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  readonly chat: ChatSummary;
  readonly onPress: () => void;
};

export function ChatListItem({ chat, onPress }: Props) {
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
  chatCard: {
    borderWidth: 1,
    borderRadius: spacing.md,
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
});
