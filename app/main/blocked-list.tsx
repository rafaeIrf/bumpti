import { ArrowLeftIcon, LockOpenIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { BlockedUser, getBlockedUsers, unblockUser } from "@/modules/block/api";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  View,
} from "react-native";

export default function BlockedListScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const blockedUsers = await getBlockedUsers();
      console.log("Blocked users fetched:", blockedUsers.length);
      setUsers(blockedUsers);
    } catch (error) {
      logger.error("Failed to fetch blocked users:", error);
      Alert.alert(t("common.error"), t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  const handleUnblock = async (userId: string, userName?: string) => {
    Alert.alert(
      t("screens.blockedList.unblockConfirmTitle"),
      t("screens.blockedList.unblockConfirmMessage"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("screens.blockedList.unblock"),
          style: "destructive",
          onPress: async () => {
            try {
              setUnblockingId(userId);
              await unblockUser(userId);
              setUsers((prev) =>
                prev.filter((u) => u.blocked_user_id !== userId)
              );
              Alert.alert(
                t("common.done"),
                t("screens.blockedList.unblockSuccess")
              );
            } catch (error) {
              logger.error("Failed to unblock user:", error);
              Alert.alert(
                t("common.error"),
                t("screens.blockedList.unblockError")
              );
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const photoUrl = item.user_details.photoUrl;
    const name = item.user_details.firstName || "User";
    const userId = item.blocked_user_id;

    return (
      <ThemedView
        style={[styles.userCard, { backgroundColor: colors.surface }]}
      >
        <View style={styles.userInfo}>
          {photoUrl && (
            <RemoteImage
              source={{ uri: photoUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          )}
          <ThemedText style={[typography.body, { flex: 1 }]} numberOfLines={1}>
            {name}
          </ThemedText>
        </View>

        <Button
          variant="secondary"
          size="sm"
          loading={unblockingId === userId}
          onPress={() => handleUnblock(userId, name)}
          leftIcon={<LockOpenIcon width={16} height={16} color={colors.text} />}
        >
          {t("screens.blockedList.unblock")}
        </Button>
      </ThemedView>
    );
  };

  return (
    <BaseTemplateScreen
      scrollEnabled={false}
      TopHeader={
        <ScreenToolbar
          title={t("screens.blockedList.title")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <ThemedView style={styles.container}>
        {loading ? (
          <ThemedView style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </ThemedView>
        ) : users.length === 0 ? (
          <ThemedView style={styles.centerContainer}>
            <ThemedText
              style={[
                typography.body,
                { color: colors.textSecondary, textAlign: "center" },
              ]}
            >
              {t("screens.blockedList.empty")}
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={users}
            renderItem={renderItem}
            keyExtractor={(item) => item.blocked_user_id}
            contentContainerStyle={{ gap: spacing.md }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: spacing.md,
    gap: spacing.md,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ccc",
  },
});
