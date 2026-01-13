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

import { AnimatedBootSplash } from "@/components/animated-bootsplash";
import BottomSheetProvider from "@/components/BottomSheetProvider";
import { ChatRealtimeProvider } from "@/components/chat-realtime-provider";
import { DatabaseProvider } from "@/components/DatabaseProvider";
import { ReduxProvider } from "@/components/redux-provider";
import { VerificationListener } from "@/components/verification-listener";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFCMRegistration } from "@/hooks/use-fcm-registration";
import { IAPProvider } from "@/modules/iap/context";
import I18nProvider from "@/modules/locales/i18n-provider";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import RNBootSplash from "react-native-bootsplash";

export const unstable_settings = {
  initialRouteName: "index",
};

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: "#000000", // Match native splash background
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    "Poppins-Regular": Poppins_400Regular,
    "Poppins-Medium": Poppins_500Medium,
    "Poppins-SemiBold": Poppins_600SemiBold,
    "Poppins-Bold": Poppins_700Bold,
  });
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [splashReady, setSplashReady] = useState(false);
  const hasHiddenSplash = useRef(false);

  // Initialize FCM registration
  useFCMRegistration();

  // Start animated splash hide when fonts are loaded and navigation is ready
  // Following best practices from react-native-bootsplash documentation
  useEffect(() => {
    if (fontsLoaded && !splashReady) {
      // Wait for multiple frames to ensure Stack is fully mounted and rendered
      // This is especially important in release builds where rendering can be slower
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSplashReady(true); // Trigger animation in AnimatedBootSplash
        });
      });
    }
  }, [fontsLoaded, splashReady]);

  const handleAnimationEnd = async () => {
    if (hasHiddenSplash.current) {
      // Already hidden, just remove component
      setShowAnimatedSplash(false);
      return;
    }

    try {
      // Hide native splash after custom animation completes
      hasHiddenSplash.current = true;
      await RNBootSplash.hide({ fade: false }); // Already animated, just hide
    } catch (error) {
      // Ignore errors if splash is already hidden
      // This can happen if the native splash was already hidden
    } finally {
      // Remove animated component from tree
      setShowAnimatedSplash(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ReduxProvider>
      <VerificationListener />
      <I18nProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <IAPProvider>
                <DatabaseProvider>
                  <BottomSheetProvider>
                    <ChatRealtimeProvider>
                      <Stack>
                        <Stack.Screen
                          name="index"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="(auth)"
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
                          name="(profile)"
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
                            presentation: "modal",
                            headerShown: false,
                            animation: "slide_from_bottom",
                          }}
                        />
                      </Stack>
                      <StatusBar style="auto" />
                    </ChatRealtimeProvider>
                  </BottomSheetProvider>
                </DatabaseProvider>
              </IAPProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
        {showAnimatedSplash && (
          <View style={styles.splashOverlay} pointerEvents="none">
            <AnimatedBootSplash ready={splashReady} onAnimationEnd={handleAnimationEnd} />
          </View>
        )}
      </I18nProvider>
    </ReduxProvider>
  );
}
