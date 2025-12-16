import { blockUser } from "@/modules/block/api";
import { updateMatch } from "@/modules/chats/api";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

interface UseUserActionsProps {
  userId?: string;
  userName?: string;
  matchId?: string;
  onBlockSuccess?: () => void;
}

export function useUserActions({
  userId,
  userName,
  matchId,
  onBlockSuccess,
}: UseUserActionsProps) {
  const [isBlocking, setIsBlocking] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnmatchModal, setShowUnmatchModal] = useState(false);

  const handleReport = useCallback(() => {
    if (!userId) return;

    router.push({
      pathname: "/(modals)/report-reasons",
      params: {
        name: userName ?? "",
        reportedUserId: userId,
      },
    });
  }, [userId, userName]);

  const handleBlock = useCallback(() => {
    setShowBlockModal(true);
  }, []);

  const confirmBlock = useCallback(async () => {
    if (!userId || isBlocking) return;
    try {
      setIsBlocking(true);
      await blockUser({ blockedUserId: userId });
      setShowBlockModal(false);
      Alert.alert(
        t("screens.chatBlock.blockSuccessTitle"),
        t("screens.chatBlock.blockSuccessMessage")
      );
      if (onBlockSuccess) {
        onBlockSuccess();
      } else {
        router.back();
      }
    } catch (err) {
      logger.error("Block user error:", err);
      Alert.alert(
        t("screens.chatBlock.blockErrorTitle"),
        t("screens.chatBlock.blockError")
      );
    } finally {
      setIsBlocking(false);
    }
  }, [userId, isBlocking, onBlockSuccess]);

  const handleUnmatch = useCallback(() => {
    setShowUnmatchModal(true);
  }, []);

  const confirmUnmatch = useCallback(async () => {
    if (!matchId || !userId || isUnmatching) return;

    try {
      setIsUnmatching(true);
      await updateMatch({
        matchId,
        status: "unmatched",
      });
      setShowUnmatchModal(false);
      router.back();
    } catch (err) {
      logger.error("Unmatch error:", err);
      Alert.alert(
        t("screens.chatUnmatch.unmatchErrorTitle"),
        t("screens.chatUnmatch.unmatchError")
      );
    } finally {
      setIsUnmatching(false);
    }
  }, [matchId, userId, isUnmatching]);

  return {
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
  };
}
