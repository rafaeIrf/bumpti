import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="edit/[field]"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="edit/favorite-places"
        options={{
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
