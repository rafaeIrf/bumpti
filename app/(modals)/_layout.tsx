import { Stack } from "expo-router";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="place-search" />
      <Stack.Screen name="place-people" />
      <Stack.Screen name="premium-paywall" />
      <Stack.Screen name="report" />
      <Stack.Screen name="profile-preview" />
    </Stack>
  );
}
