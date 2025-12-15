import { ThemedText } from "@/components/themed-text";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { MatchSummary } from "@/modules/chats/messagesApi";
import { t } from "@/modules/locales";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  readonly match: MatchSummary;
  readonly onPress: () => void;
};

export function MatchAvatar({ match, onPress }: Props) {
  const colors = useThemeColors();
  const initial = match.other_user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <Pressable
      style={{
        alignItems: "center",
        paddingTop: spacing.sm,
        overflow: "visible",
      }}
      accessibilityLabel={match.other_user?.name ?? "Match"}
      onPress={onPress}
    >
      <View
        style={[
          styles.matchAvatar,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        {match.other_user?.photo_url ? (
          <RemoteImage
            source={{ uri: match.other_user.photo_url }}
            style={styles.matchAvatarImage}
          />
        ) : (
          <ThemedText style={[typography.body1, { color: colors.text }]}>
            {initial}
          </ThemedText>
        )}
        {match.is_new_match && (
          <View
            style={[
              styles.newDot,
              {
                backgroundColor: colors.accent,
              },
            ]}
          />
        )}
      </View>
      <ThemedText
        numberOfLines={1}
        style={[
          typography.caption,
          {
            color: colors.text,
            marginTop: spacing.xs,
          },
        ]}
      >
        {match.other_user?.name ?? t("screens.chat.title")}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  matchAvatar: {
    width: 80,
    height: 100,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  matchAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  newDot: {
    position: "absolute",
    bottom: -spacing.xs,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
