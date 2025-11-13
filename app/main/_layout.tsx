import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="category-results"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="place-people"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
