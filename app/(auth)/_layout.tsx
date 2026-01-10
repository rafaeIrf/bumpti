import { Stack } from "expo-router";

export const unstable_settings = {
  initialRouteName: "welcome",
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="phone-auth" />
      <Stack.Screen name="verify-code" />
    </Stack>
  );
}
