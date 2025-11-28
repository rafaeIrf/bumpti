import { Stack } from "expo-router";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="place-search"
        options={{
          presentation: "modal",
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="place-people"
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
