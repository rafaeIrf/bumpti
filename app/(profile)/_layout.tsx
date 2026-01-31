import { Stack } from "expo-router";

export default function ProfileModalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edit/[field]" options={{ presentation: "modal" }} />
      <Stack.Screen name="university" options={{ presentation: "modal" }} />
      <Stack.Screen
        name="favorite-places"
        options={{ presentation: "modal" }}
      />
    </Stack>
  );
}
