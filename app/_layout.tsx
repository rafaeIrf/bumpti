import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";

import BottomSheetProvider from "@/components/BottomSheetProvider";
import { ChatRealtimeProvider } from "@/components/chat-realtime-provider";
import { ReduxProvider } from "@/components/redux-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import I18nProvider from "@/modules/locales/i18n-provider";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    "Poppins-Regular": Poppins_400Regular,
    "Poppins-Medium": Poppins_500Medium,
    "Poppins-SemiBold": Poppins_600SemiBold,
    "Poppins-Bold": Poppins_700Bold,
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ReduxProvider>
      <I18nProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <BottomSheetProvider>
                <ChatRealtimeProvider>
                  <Stack>
                    <Stack.Screen
                      name="index"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="(onboarding)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="main"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="(modals)"
                      options={{
                        headerShown: false,
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                  </Stack>
                  <StatusBar style="auto" />
                </ChatRealtimeProvider>
              </BottomSheetProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
      </I18nProvider>
    </ReduxProvider>
  );
}
