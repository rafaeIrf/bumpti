import { Stack } from "expo-router";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="place-people" />
      <Stack.Screen name="premium-paywall" />
      <Stack.Screen name="report" />
      <Stack.Screen name="profile-preview" />
      <Stack.Screen name="place-search" />
      <Stack.Screen name="verification-webview" />
      <Stack.Screen name="update-suggestion" />
      <Stack.Screen name="rating-feedback" />
      <Stack.Screen name="create-plan" />
      <Stack.Screen name="vibe-check" />
      <Stack.Screen name="join-plan" />
      <Stack.Screen name="social-hubs" />
      <Stack.Screen name="popular-hubs" />
      <Stack.Screen name="manage-subscription" />
      <Stack.Screen name="place-report" />
      <Stack.Screen name="rate-place" />
      <Stack.Screen name="referral-hub" />
      <Stack.Screen name="university-search" />
    </Stack>
  );
}
