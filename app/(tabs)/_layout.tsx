import { Tabs } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  CompassIcon,
  MapPinIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from "@/assets/icons";
import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useChatPrefetch } from "@/hooks/use-chat-prefetch";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useProfile } from "@/hooks/use-profile";
import { useProfilePrefetch } from "@/hooks/use-profile-prefetch";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import { useGetChatsQuery } from "@/modules/chats/messagesApi";
import { View } from "react-native";

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  useProfile(); // Preload profile data into Redux
  useProfilePrefetch(); // Background prefetch images
  useChatPrefetch(); // Background prefetch chat images & data

  const { data: chats = [] } = useGetChatsQuery();
  const unreadCount = useMemo(() => {
    return chats.reduce((acc, chat) => acc + (chat.unread_count || 0), 0);
  }, [chats]);

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
          href: null,
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
