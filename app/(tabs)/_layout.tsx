import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, type AppStateStatus } from "react-native";

import {
  CompassIcon,
  MapPinIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from "@/assets/icons";
import { useDatabase } from "@/components/DatabaseProvider";
import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePendingLikesPrefetch } from "@/hooks/use-pending-likes-prefetch";
import { useProfile } from "@/hooks/use-profile";
import { useProfilePrefetch } from "@/hooks/use-profile-prefetch";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import type Message from "@/modules/database/models/Message";
import {
  checkAndShowRatingModal,
  incrementSessionCount,
} from "@/utils/rating-service";
import { Q } from "@nozbe/watermelondb";
import { View } from "react-native";

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile(); // Preload profile data into Redux
  useProfilePrefetch(); // Background prefetch images
  usePendingLikesPrefetch();

  const database = useDatabase();
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = profile?.id;

  // Track sessions and check rating modal (only when user is authenticated and in main app)
  useEffect(() => {
    // Increment session count on mount (user reached tabs)
    incrementSessionCount().then(() => {
      checkAndShowRatingModal();
    });

    // Also check on app foreground
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          incrementSessionCount().then(() => {
            checkAndShowRatingModal();
          });
        }
      },
    );

    return () => subscription.remove();
  }, []);

  // Derive unread count directly from messages table
  // This avoids WatermelonDB sync conflicts where local updates to Chat.unreadCount
  // would be preserved over server values due to "per-column client-wins" strategy
  useEffect(() => {
    if (!userId) return;

    const subscription = database.collections
      .get<Message>("messages")
      .query(Q.where("read_at", null), Q.where("sender_id", Q.notEq(userId)))
      .observeCount()
      .subscribe((count) => {
        setUnreadCount(count);
      });

    return () => subscription.unsubscribe();
  }, [database, userId]);

  return (
    <Tabs
      initialRouteName="(home)"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 70 + (insets.bottom || 0),
          paddingBottom: Math.max(18, insets.bottom),
          paddingTop: 10,
          backgroundColor: Colors[colorScheme ?? "light"].background,
          borderTopWidth: 0,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t("explore"),
          tabBarIcon: ({ color }) => (
            <MapPinIcon width={28} height={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(discover)"
        options={{
          title: t("discover"),
          tabBarIcon: ({ color }) => (
            <CompassIcon width={28} height={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(chat)"
        options={{
          title: t("matches"),
          tabBarIcon: ({ color }) => (
            <View>
              <MessageCircleIcon width={28} height={28} color={color} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    top: -2,
                    backgroundColor: "#007AFF", // iOS active blue or use theme accent
                    width: 5,
                    height: 5,
                    borderRadius: 5,
                    borderColor: Colors[colorScheme ?? "light"].background, // matching tab background for cutout effect
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color }) => (
            <UserRoundIcon width={28} height={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
