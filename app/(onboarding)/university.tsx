import { SearchIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import ToggleSwitch from "@/components/toogle-switch";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useScreenTracking } from "@/modules/analytics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

interface SelectedUniversity {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 50;
const MAX_YEAR = CURRENT_YEAR + 10;

export default function UniversityScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { userData, completeCurrentStep } = useOnboardingFlow();

  // Track screen view
  useScreenTracking({
    screenName: "onboarding_university",
    params: {
    onboarding_step: 10,
    step_name: "university",
    },
  });

  // State
  const [selectedUniversity, setSelectedUniversity] =
    useState<SelectedUniversity | null>(
      userData.universityId
        ? {
            id: userData.universityId,
            name: userData.universityName || "",
            lat: userData.universityLat ?? undefined,
            lng: userData.universityLng ?? undefined,
          }
        : null,
    );
  const [isManualMode, setIsManualMode] = useState(
    !!userData.universityNameCustom && !userData.universityId,
  );
  const [customUniversityName, setCustomUniversityName] = useState(
    userData.universityNameCustom || "",
  );
  const [graduationYear, setGraduationYear] = useState(
    userData.graduationYear?.toString() || "",
  );
  const [showOnHome, setShowOnHome] = useState(
    userData.showUniversityOnHome !== false,
  );
  const [yearError, setYearError] = useState<string | null>(null);

  // Pure validation function (no side effects) - for use in useMemo
  const isYearValid = useCallback((value: string): boolean => {
    if (!value.trim()) {
      return true; // Empty is valid (optional field)
    }

    const year = parseInt(value, 10);
    if (isNaN(year)) {
      return false;
    }

    if (year < MIN_YEAR || year > MAX_YEAR) {
      return false;
    }

    return true;
  }, []);

  // Validation with side effects (sets error message) - for onChange
  const validateGraduationYear = useCallback((value: string) => {
    if (!value.trim()) {
      setYearError(null);
      return true;
    }

    const year = parseInt(value, 10);
    if (isNaN(year)) {
      setYearError(t("screens.onboarding.university.yearInvalid"));
      return false;
    }

    if (year < MIN_YEAR || year > MAX_YEAR) {
      setYearError(
        t("screens.onboarding.university.yearOutOfRange", {
          min: MIN_YEAR,
          max: MAX_YEAR,
        }),
      );
      return false;
    }

    setYearError(null);
    return true;
  }, []);

  const handleGraduationYearChange = useCallback(
    (text: string) => {
      // Only allow numbers
      const numericValue = text.replace(/[^0-9]/g, "");
      setGraduationYear(numericValue);
      if (numericValue.length === 4) {
        validateGraduationYear(numericValue);
      } else {
        setYearError(null);
      }
    },
    [validateGraduationYear],
  );

  // Handle search modal callback
  const handleOpenSearch = useCallback(() => {
    // @ts-ignore
    globalThis.__universitySearchCallback = (place: {
      id: string;
      name: string;
      address?: string;
      lat?: number;
      lng?: number;
    }) => {
      logger.log("[UniversityScreen] University selected:", place);
      setSelectedUniversity({
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      });
      setIsManualMode(false);
      setCustomUniversityName("");
      // @ts-ignore
      delete globalThis.__universitySearchCallback;
    };

    router.push({
      pathname: "/(onboarding)/university-search",
    });
  }, [router]);

  const handleRemoveUniversity = useCallback(() => {
    setSelectedUniversity(null);
  }, []);

  const handleSwitchToManual = useCallback(() => {
    setIsManualMode(true);
    setSelectedUniversity(null);
  }, []);

  const handleSwitchToSearch = useCallback(() => {
    setIsManualMode(false);
    setCustomUniversityName("");
  }, []);

  // Check if form is valid - university is OPTIONAL, only year matters
  const isFormValid = useMemo(() => {
    // Year validation (pure check, no side effects)
    // Only validate if a year was entered
    if (graduationYear && !isYearValid(graduationYear)) {
      return false;
    }

    // University is optional - always allow continue
    return true;
  }, [graduationYear, isYearValid]);

  const handleContinue = useCallback(() => {
    // Validate year one more time
    if (graduationYear && !validateGraduationYear(graduationYear)) {
      return;
    }

    // Save to Redux
    onboardingActions.setUniversityData({
      universityId: selectedUniversity?.id ?? null,
      universityName: selectedUniversity?.name ?? null,
      universityNameCustom: isManualMode ? customUniversityName.trim() : null,
      universityLat: selectedUniversity?.lat ?? null,
      universityLng: selectedUniversity?.lng ?? null,
      graduationYear: graduationYear ? parseInt(graduationYear, 10) : null,
      showUniversityOnHome: showOnHome,
    });

    logger.log("[UniversityScreen] University data saved:", {
      universityId: selectedUniversity?.id,
      universityName: selectedUniversity?.name,
      customName: isManualMode ? customUniversityName : null,
      graduationYear,
      showOnHome,
    });

    completeCurrentStep("university");
  }, [
    selectedUniversity,
    isManualMode,
    customUniversityName,
    graduationYear,
    showOnHome,
    validateGraduationYear,
    completeCurrentStep,
  ]);

  const handleSkip = useCallback(() => {
    // Clear university data and continue
    onboardingActions.setUniversityData({
      universityId: null,
      universityName: null,
      universityNameCustom: null,
      universityLat: null,
      universityLng: null,
      graduationYear: null,
      showUniversityOnHome: true,
    });
    completeCurrentStep("university");
  }, [completeCurrentStep]);

  return (
    <BaseTemplateScreen
      hasStackHeader
      useKeyboardAvoidingView
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 3,
      }}
      scrollEnabled
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("screens.onboarding.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={!isFormValid}
          secondaryLabel={t("common.skip")}
          onSecondaryPress={handleSkip}
        />
      }
    >
      {/* Header */}
      <ThemedText style={[styles.heading, { color: colors.text }]}>
        {t("screens.onboarding.university.title")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.university.subtitle")}
      </ThemedText>

      {/* University Selection */}
      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionLabel, { color: colors.textSecondary }]}
        >
          {t("screens.onboarding.university.universityLabel")}
        </ThemedText>

        {!isManualMode && !selectedUniversity && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
          >
            {/* Pseudo Input - Search Trigger */}
            <Pressable
              onPress={handleOpenSearch}
              style={({ pressed }) => [
                styles.pseudoInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <SearchIcon width={20} height={20} color={colors.textSecondary} />
              <ThemedText style={{ color: colors.textSecondary, flex: 1 }}>
                {t("screens.onboarding.university.searchPlaceholder")}
              </ThemedText>
            </Pressable>

            {/* Manual Entry Link */}
            <Pressable onPress={handleSwitchToManual} style={styles.manualLink}>
              <ThemedText
                style={[styles.manualLinkText, { color: colors.accent }]}
              >
                {t("screens.onboarding.university.notFound")}
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}

        {!isManualMode && selectedUniversity && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
          >
            {/* Selected University Card */}
            <View
              style={[
                styles.selectedCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.accent,
                },
              ]}
            >
              <View style={styles.selectedCardContent}>
                <ThemedText
                  style={[
                    typography.body,
                    { color: colors.text, fontWeight: "600" },
                  ]}
                  numberOfLines={1}
                >
                  {selectedUniversity.name}
                </ThemedText>
                {selectedUniversity.address && (
                  <ThemedText
                    style={[
                      typography.caption,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedUniversity.address}
                  </ThemedText>
                )}
              </View>
              <Pressable
                onPress={handleRemoveUniversity}
                style={[
                  styles.removeButton,
                  { backgroundColor: colors.border },
                ]}
                hitSlop={8}
              >
                <XIcon width={16} height={16} color={colors.text} />
              </Pressable>
            </View>
          </Animated.View>
        )}

        {isManualMode && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
          >
            {/* Manual Input */}
            <TextInput
              value={customUniversityName}
              onChangeText={setCustomUniversityName}
              placeholder={t("screens.onboarding.university.manualPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  ...typography.body,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              autoFocus
            />

            {/* Switch back to search */}
            <Pressable onPress={handleSwitchToSearch} style={styles.manualLink}>
              <ThemedText
                style={[styles.manualLinkText, { color: colors.accent }]}
              >
                {t("screens.onboarding.university.searchInstead")}
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Graduation Year */}
      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionLabel, { color: colors.textSecondary }]}
        >
          {t("screens.onboarding.university.yearLabel")}
        </ThemedText>
        <TextInput
          value={graduationYear}
          onChangeText={handleGraduationYearChange}
          placeholder={t("screens.onboarding.university.yearPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={4}
          style={[
            styles.input,
            styles.yearInput,
            {
              ...typography.body,
              backgroundColor: colors.surface,
              borderColor: yearError ? colors.error : colors.border,
              color: colors.text,
            },
          ]}
        />
        {yearError && (
          <Animated.View entering={FadeIn.duration(150)}>
            <ThemedText style={[styles.errorText, { color: colors.error }]}>
              {yearError}
            </ThemedText>
          </Animated.View>
        )}
      </View>

      {/* Show on Home Toggle - only show when we have a selected university (with placeId) */}
      {!isManualMode && selectedUniversity && (
        <View style={styles.section}>
          <View
            style={[
              styles.toggleContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.toggleContent}>
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.onboarding.university.showOnHomeTitle")}
              </ThemedText>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t("screens.onboarding.university.showOnHomeSubtitle")}
              </ThemedText>
            </View>
            <ToggleSwitch
              value={showOnHome}
              onValueChange={setShowOnHome}
              colors={colors}
            />
          </View>
        </View>
      )}
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.heading,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pseudoInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  yearInput: {
    width: 120,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
    gap: spacing.sm,
  },
  selectedCardContent: {
    flex: 1,
    gap: 2,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  manualLink: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  manualLinkText: {
    ...typography.caption,
    fontWeight: "500",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.md,
  },
  toggleContent: {
    flex: 1,
    gap: 2,
  },
  errorText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
