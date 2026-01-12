import { ThemedText } from "@/components/themed-text";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type Chat from "@/modules/database/models/Chat";
import { t } from "@/modules/locales";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  readonly chat: Chat;
  readonly onPress: (chat: Chat) => void;
};

export function ChatListItem({ chat, onPress }: Props) {
  const colors = useThemeColors();

  return (
    <Pressable onPress={() => onPress(chat)}>
      <View style={styles.chatRow}>
        <UserAvatar
          name={chat.otherUserName}
          photoUrl={chat.otherUserPhotoUrl ?? undefined}
          hasUnread={chat.unreadCount > 0}
        />
        <View style={styles.chatInfo}>
          <ThemedText style={[typography.body1, { color: colors.text }]}>
            {chat.otherUserName ?? t("screens.chat.title")}
          </ThemedText>
          {chat.lastMessageContent ? (
            <ThemedText
              numberOfLines={1}
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.xs },
              ]}
            >
              {chat.lastMessageContent}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          style={[typography.caption, { color: colors.textSecondary }]}
        >
          {formatTime(
            chat.lastMessageAt?.toISOString() || chat.createdAt.toISOString()
          )}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function UserAvatar({
  name,
  photoUrl,
  hasUnread = false,
}: {
  name?: string | null;
  photoUrl?: string | null;
  hasUnread?: boolean;
}) {
  const colors = useThemeColors();
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <View style={styles.avatarContainer}>
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
          <RemoteImage source={{ uri: photoUrl }} style={styles.avatarImage} />
        ) : (
          <ThemedText style={[typography.body1, { color: colors.text }]}>
            {initial}
          </ThemedText>
        )}
      </View>
      {hasUnread && (
        <View
          style={[styles.unreadBadge, { backgroundColor: colors.accent }]}
        />
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
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  unreadBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
