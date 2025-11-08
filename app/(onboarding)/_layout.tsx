import { Stack } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="phone-auth" options={{ headerShown: false }} />
      <Stack.Screen name="verify-code" options={{ headerShown: false }} />
      <Stack.Screen name="user-name" options={{ headerShown: false }} />
      <Stack.Screen name="user-age" options={{ headerShown: false }} />
      <Stack.Screen name="user-gender" options={{ headerShown: false }} />
      <Stack.Screen name="connect-with" options={{ headerShown: false }} />
      <Stack.Screen name="intention" options={{ headerShown: false }} />
      <Stack.Screen name="user-photos" options={{ headerShown: false }} />
      <Stack.Screen name="location" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="complete" options={{ headerShown: false }} />
    </Stack>
  );
}
