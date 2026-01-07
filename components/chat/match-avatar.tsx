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
      style={styles.container}
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
                borderColor: colors.background, // Cutout effect
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
            alignSelf: "center",
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
  container: {
    marginRight: spacing.sm,
  },
  matchAvatar: {
    width: 64,
    height: 64,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
  },
  newDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#000", // Will be overridden by theme surface color in component if needed, but black works for dark mode
  },
});
