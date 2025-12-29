import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="category-results"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="filters"
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="message"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="place-search"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="favorite-places"
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
