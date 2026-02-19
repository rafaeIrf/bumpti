import type { UserAvatar } from "@/modules/places/types";
import { isAndroid } from "@/utils";
import { Image } from "expo-image";
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

interface StackedAvatarsProps {
  /** Avatars with user_id and url */
  avatars: UserAvatar[];
  /** Total user count (for +X badge) */
  totalCount: number;
  /** Maximum avatars to show before +X badge (default: 4) */
  maxVisible?: number;
  /** Avatar size in pixels (default: 24) */
  size?: number;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Optional style for each avatar circle */
  avatarStyle?: StyleProp<ViewStyle>;
}

/**
 * Stacked avatar circles with blue blur overlay for privacy.
 * Displays up to maxVisible avatars with a +X badge for overflow.
 */
export function StackedAvatars({
  avatars,
  totalCount,
  maxVisible = 4,
  size = 32,
  style,
  avatarStyle,
}: StackedAvatarsProps) {
  const visibleAvatars = avatars.slice(0, maxVisible);
  // Use the larger of totalCount or actual avatar count — handles cold start
  // where active_users=0 but regulars avatars are present
  const effectiveCount = Math.max(totalCount, avatars.length);
  const overflowCount = effectiveCount - visibleAvatars.length;
  const overlap = size * 0.4; // 40% overlap

  if (effectiveCount === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { height: size }, style]}>
      {visibleAvatars.map((avatar, index) => (
        <View
          key={avatar.user_id}
          style={[
            styles.avatarContainer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: index === 0 ? 0 : -overlap,
              zIndex: index + 1,
            },
            avatarStyle,
          ]}
        >
          <Image
            source={{ uri: avatar.url }}
            style={[
              styles.avatar,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
            contentFit="cover"
            blurRadius={isAndroid ? 2 : 10}
          />
        </View>
      ))}

      {/* +X overflow badge */}
      {overflowCount > 0 && (
        <View
          style={[
            styles.overflowBadge,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -overlap,
              zIndex: maxVisible + 1,
            },
            avatarStyle,
          ]}
        >
          <Text style={[styles.overflowText, { fontSize: size * 0.4 }]}>
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#0F0F0F",
  },
  avatar: {
    backgroundColor: "#2F3336",
  },
  overflowBadge: {
    backgroundColor: "#1D9BF0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0F0F0F",
  },
  overflowText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
