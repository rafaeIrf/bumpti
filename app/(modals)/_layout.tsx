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
          headerShown: false,
        }}
      />
    </Stack>
  );
}
