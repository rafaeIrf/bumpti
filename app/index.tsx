import { useThemeColors } from "@/hooks/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function RootIndex() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const colors = useThemeColors();

  useEffect(() => {
    (async () => {
      try {
        const value = await AsyncStorage.getItem("hasOnboarded");
        setHasOnboarded(value === "true");
      } catch {
        // If it fails, default to showing onboarding
        setHasOnboarded(false);
      }
    })();
  }, []);

  if (hasOnboarded === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return hasOnboarded ? (
    <Redirect href="/(tabs)/(home)" />
  ) : (
    <Redirect href="/(onboarding)/welcome" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
