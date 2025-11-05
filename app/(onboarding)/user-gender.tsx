import { ArrowLeftIcon, CheckIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { GenderIdentityBottomSheet } from "@/components/gender-identity-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function UserGenderScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const bottomSheet = useCustomBottomSheet();

  const [gender, setGender] = useState("");

  const genderOptions = [
    {
      value: "Mulher",
      emoji: "👩",
      label: t("screens.onboarding.genderWoman"),
    },
    { value: "Homem", emoji: "👨", label: t("screens.onboarding.genderMan") },
    {
      value: "Não binário",
      emoji: "⚧️",
      label: t("screens.onboarding.genderNonBinary"),
    },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleGenderSelect = (value: string) => {
    if (value === "Não binário") {
      bottomSheet?.expand({
        content: () => (
          <GenderIdentityBottomSheet
            onSelect={(identity) => {
              setGender(identity);
              bottomSheet.close();
            }}
            onClose={() => bottomSheet.close()}
          />
        ),
        snapPoints: ["70%"],
      });
    } else {
      setGender(value);
    }
  };

  const handleContinue = () => {
    if (gender) {
      // TODO: Save gender to profile/storage
      console.log("Gender:", gender);

      // Navigate to home screen
      router.replace("/(tabs)/(home)" as any);
    }
  };

  const isValid = Boolean(gender);
  const isNonBinaryGender = gender && gender !== "Mulher" && gender !== "Homem";

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: handleBack,
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.header}
          >
            <ThemedText style={[styles.title, { color: colors.text }]}>
              {t("screens.onboarding.genderTitle")}
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              {t("screens.onboarding.genderSubtitle")}
            </ThemedText>
          </Animated.View>

          {/* Gender Options */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(600)}
            style={styles.optionsContainer}
          >
            {genderOptions.map((option) => {
              const isSelected =
                gender === option.value ||
                (option.value === "Não binário" && isNonBinaryGender);

              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleGenderSelect(option.value)}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isSelected
                        ? `${colors.accent}1A`
                        : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <View style={styles.optionContent}>
                    <ThemedText
                      style={[
                        styles.optionLabel,
                        {
                          color: isSelected
                            ? colors.text
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                    {isSelected && (
                      <View style={{ flex: 0, marginLeft: 'auto' }}>
                        <CheckIcon width={20} height={20} color={colors.accent} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>

          {/* Selected identity preview removido */}

          {/* Continue Button */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(600)}
            style={styles.buttonContainer}
          >
            <Button
              onPress={handleContinue}
              disabled={!isValid}
              size="lg"
              fullWidth
            >
              {t("screens.onboarding.continue")}
            </Button>
          </Animated.View>

          {/* Info text */}
          <ThemedText
            style={[styles.infoText, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.genderUpdateInfo")}
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionButton: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  emoji: {
    fontSize: 28,
  },
  optionLabel: {
    ...typography.body,
    flex: 1,
    fontWeight: "600",
  },
  identityPreview: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  identityText: {
    ...typography.caption,
    fontWeight: "500",
  },
  buttonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.caption,
    textAlign: "center",
  },
});
