import NatureFunIllustration from "@/assets/images/onboarding/undraw-nature-fun.svg";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing } from "@/constants/theme";
import { t } from "@/modules/locales";
import { router } from "expo-router";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Welcome Screen - Tela de recepção do onboarding
 *
 * Primeira tela que o usuário vê ao iniciar o onboarding.
 * Apresenta o Bumpti com uma ilustração e um botão para começar.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const handleStart = () => {
    router.push("/(onboarding)/intro-carousel");
  };

  return (
    <ThemedView
      style={[styles.container, { paddingBottom: insets.bottom + spacing.md }]}
    >
      {/* Ilustração unDraw Nature fun */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(600)}
        style={styles.illustrationContainer}
      >
        <NatureFunIllustration width="100%" height="100%" />
      </Animated.View>

      {/* Conteúdo de texto */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(600)}
        style={styles.contentContainer}
      >
        <ThemedText style={styles.title}>
          {t("screens.onboarding.welcome.title")}
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {t("screens.onboarding.welcome.subtitle")}
        </ThemedText>
      </Animated.View>

      {/* Botão de ação */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(600)}
        style={styles.buttonContainer}
      >
        <Button
          label={t("screens.onboarding.welcome.button")}
          onPress={handleStart}
          size="lg"
          fullWidth
        />
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
  },
  illustrationContainer: {
    flex: 0.5,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  illustration: {
    width: "100%",
    height: "100%",
    maxHeight: 400,
  },
  contentContainer: {
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    color: "#FFFFFF",
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    marginTop: "auto",
  },
});
