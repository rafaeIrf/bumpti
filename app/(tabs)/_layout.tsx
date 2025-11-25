import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  CompassIcon,
  MapPinIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from "@/assets/icons";
import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import { useProfile } from "@/hooks/use-profile";

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  useProfile(); // Preload profile data into Redux

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
            <MessageCircleIcon width={28} height={28} color={color} />
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
