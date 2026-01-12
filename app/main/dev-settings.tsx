import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { LoadingView } from "@/components/loading-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useDatabase } from "@/components/DatabaseProvider";
import type Chat from "@/modules/database/models/Chat";
import type LikerId from "@/modules/database/models/LikerId";
import type Match from "@/modules/database/models/Match";
import type Message from "@/modules/database/models/Message";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

type DevDbState = {
  likerIds: string[];
  matches: Match[];
  chats: Chat[];
  messages: Message[];
};

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  const colors = useThemeColors();
  return (
    <ThemedText style={[styles.sectionHeader, { color: colors.textSecondary }]}>
      {title}
    </ThemedText>
  );
}

export default function DevSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const database = useDatabase();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DevDbState>({
    likerIds: [],
    matches: [],
    chats: [],
    messages: [],
  });
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const likerCollection = database.collections.get<LikerId>("liker_ids");
      const matchCollection = database.collections.get<Match>("matches");
      const chatCollection = database.collections.get<Chat>("chats");
      const messageCollection = database.collections.get<Message>("messages");

      const [likers, matches, chats, messages] = await Promise.all([
        likerCollection.query().fetch(),
        matchCollection.query().fetch(),
        chatCollection.query().fetch(),
        messageCollection.query().fetch(),
      ]);

      setData({
        likerIds: likers.map((record) => record.id),
        matches,
        chats,
        messages,
      });
    } catch (error) {
      logger.error("Failed to load dev settings data", { error });
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const matchLookup = useMemo(() => {
    const map = new Map<string, Match>();
    data.matches.forEach((match) => map.set(match.id, match));
    return map;
  }, [data.matches]);

  const formatDate = (value?: Date | null) =>
    value ? value.toISOString() : "-";

  const TopHeader = (
    <ScreenToolbar
      title={t("screens.profile.devSettings.title")}
      leftAction={{
        icon: ArrowLeftIcon,
        onClick: () => router.back(),
        ariaLabel: t("common.back"),
      }}
    />
  );

  if (isLoading) {
    return (
      <BaseTemplateScreen TopHeader={TopHeader}>
        <LoadingView />
      </BaseTemplateScreen>
    );
  }

  return (
    <BaseTemplateScreen TopHeader={TopHeader}>
      <ThemedView style={styles.container}>
        <SectionHeader title={t("screens.profile.devSettings.database.title")} />
        <View style={styles.section}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText style={[typography.body, { color: colors.text }]}>
              {t("screens.profile.devSettings.database.matchesTitle")}
            </ThemedText>
            {data.matches.length === 0 ? (
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.profile.devSettings.database.matchesEmpty")}
              </ThemedText>
            ) : (
              data.matches.slice(0, 50).map((match) => {
                const isExpanded = expandedMatchId === match.id;
                return (
                  <View key={match.id} style={styles.listItem}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() =>
                        setExpandedMatchId(isExpanded ? null : match.id)
                      }
                    >
                      <ThemedText
                        style={[typography.body, { color: colors.text }]}
                      >
                        {match.id}
                      </ThemedText>
                    </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.details}>
                          <ThemedText
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {t("screens.profile.devSettings.fields.id", {
                              value: match.id,
                            })}
                          </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.status", {
                            value: match.status ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.otherUserId", {
                            value: match.otherUserId ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.otherUser", {
                            value: match.otherUserName ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.place", {
                            value: match.placeName ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.matchedAt", {
                            value: formatDate(match.matchedAt),
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.unmatchedAt", {
                            value: formatDate(match.unmatchedAt),
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.chatId", {
                            value: match.chatId ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t(
                            "screens.profile.devSettings.fields.firstMessageAt",
                            {
                              value: formatDate(match.firstMessageAt),
                            }
                          )}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText style={[typography.body, { color: colors.text }]}>
              {t("screens.profile.devSettings.database.chatsTitle")}
            </ThemedText>
            {data.chats.length === 0 ? (
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.profile.devSettings.database.chatsEmpty")}
              </ThemedText>
            ) : (
              data.chats.slice(0, 50).map((chat) => {
                const isExpanded = expandedChatId === chat.id;
                const match = matchLookup.get(chat.matchId);
                return (
                  <View key={chat.id} style={styles.listItem}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() =>
                        setExpandedChatId(isExpanded ? null : chat.id)
                      }
                    >
                      <ThemedText
                        style={[typography.body, { color: colors.text }]}
                      >
                        {chat.id}
                      </ThemedText>
                    </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.details}>
                          <ThemedText
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {t("screens.profile.devSettings.fields.id", {
                              value: chat.id,
                            })}
                          </ThemedText>
                          <ThemedText
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {t("screens.profile.devSettings.fields.matchId", {
                              value: chat.matchId,
                            })}
                          </ThemedText>
                          <ThemedText
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {t("screens.profile.devSettings.fields.otherUserId", {
                              value: chat.otherUserId ?? "-",
                            })}
                          </ThemedText>
                          <ThemedText
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {t("screens.profile.devSettings.fields.status", {
                              value: match?.status ?? "-",
                            })}
                          </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.otherUser", {
                            value: chat.otherUserName ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.place", {
                            value: chat.placeName ?? "-",
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.lastMessageAt", {
                            value: formatDate(chat.lastMessageAt),
                          })}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("screens.profile.devSettings.fields.unreadCount", {
                            value: String(chat.unreadCount ?? 0),
                          })}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText style={[typography.body, { color: colors.text }]}>
              {t("screens.profile.devSettings.database.messagesTitle")}
            </ThemedText>
            {data.messages.length === 0 ? (
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.profile.devSettings.database.messagesEmpty")}
              </ThemedText>
            ) : (
              data.messages.slice(0, 50).map((message) => (
                <ThemedText
                  key={message.id}
                  style={[typography.body, styles.listItem, { color: colors.text }]}
                >
                  {t("screens.profile.devSettings.database.messagesItem", {
                    id: message.id,
                    chatId: message.chatId,
                    senderId: message.senderId,
                  })}
                </ThemedText>
              ))
            )}
          </View>
        </View>

        <SectionHeader title={t("screens.profile.devSettings.likerIds.title")} />
        <View style={styles.section}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {t("screens.profile.devSettings.likerIds.count", {
                count: data.likerIds.length,
              })}
            </ThemedText>
            {data.likerIds.length === 0 ? (
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.profile.devSettings.likerIds.empty")}
              </ThemedText>
            ) : (
              data.likerIds.map((id) => (
                <ThemedText
                  key={id}
                  style={[typography.body, styles.listItem, { color: colors.text }]}
                >
                  {id}
                </ThemedText>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Button
            label={t("common.refresh")}
            onPress={loadData}
            variant="default"
            size="lg"
            fullWidth
          />
        </View>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  sectionHeader: {
    ...typography.captionBold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  listItem: {
    gap: spacing.xs,
  },
  listRow: {
    paddingVertical: spacing.xs,
  },
  details: {
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
});
