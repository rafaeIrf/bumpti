import { ArrowLeftIcon, SearchIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";

import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { updateProfile } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";
import { navigateToNextProfileField } from "@/utils/profile-flow";
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

export default function UniversityEditScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.data);

  // State - initialize from profile
  const [selectedUniversity, setSelectedUniversity] =
    useState<SelectedUniversity | null>(
      profile?.university_id
        ? {
            id: profile.university_id,
            name: profile.university_name || "",
            lat: profile.university_lat ?? undefined,
            lng: profile.university_lng ?? undefined,
          }
        : null,
    );
  const [isManualMode, setIsManualMode] = useState(
    !!profile?.university_name_custom && !profile?.university_id,
  );
  const [customUniversityName, setCustomUniversityName] = useState(
    profile?.university_name_custom || "",
  );
  const [graduationYear, setGraduationYear] = useState(
    profile?.graduation_year?.toString() || "",
  );

  const [yearError, setYearError] = useState<string | null>(null);

  const isYearValid = useCallback((value: string): boolean => {
    if (!value.trim()) return true;
    const year = parseInt(value, 10);
    if (isNaN(year)) return false;
    if (year < MIN_YEAR || year > MAX_YEAR) return false;
    return true;
  }, []);

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

  const handleOpenSearch = useCallback(() => {
    // @ts-ignore
    globalThis.__universitySearchCallback = (place: {
      id: string;
      name: string;
      address?: string;
      lat?: number;
      lng?: number;
    }) => {
      logger.log("[UniversityEdit] University selected:", place);
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

    router.push("/(modals)/university-search");
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

  const isFormValid = useMemo(() => {
    if (graduationYear && !isYearValid(graduationYear)) {
      return false;
    }
    return true;
  }, [graduationYear, isYearValid]);

  const handleSave = useCallback(async () => {
    if (!profile) {
      router.back();
      return;
    }

    if (graduationYear && !validateGraduationYear(graduationYear)) {
      return;
    }

    const updatePayload: {
      university_id?: string | null;
      university_name_custom?: string | null;
      graduation_year?: number | null;
    } = {
      university_id: selectedUniversity?.id ?? null,
      university_name_custom: isManualMode ? customUniversityName.trim() : null,
      graduation_year: graduationYear ? parseInt(graduationYear, 10) : null,
    };

    const updatedProfile = {
      ...profile,
      ...updatePayload,
      university_name: selectedUniversity?.name || null,
      university_lat: selectedUniversity?.lat || null,
      university_lng: selectedUniversity?.lng || null,
    };

    // Optimistic update
    dispatch(setProfile(updatedProfile));

    // Background API update
    updateProfile(updatePayload)
      .then(() => {
        logger.log("[UniversityEdit] Profile updated successfully");
      })
      .catch((error) => {
        logger.error("[UniversityEdit] Failed to update profile:", error);
      });

    navigateToNextProfileField("university", updatedProfile);
  }, [
    profile,
    selectedUniversity,
    isManualMode,
    customUniversityName,
    graduationYear,
    validateGraduationYear,
    dispatch,
  ]);

  return (
    <BaseTemplateScreen
      hasStackHeader={false}
      isModal
      useKeyboardAvoidingView
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 3,
      }}
      scrollEnabled
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.profileEdit.more.university")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("common.save")}
          onPrimaryPress={handleSave}
          primaryDisabled={!isFormValid}
        />
      }
    >
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
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
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

  errorText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
