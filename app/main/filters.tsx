import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { GenderSelectionBottomSheetContent } from "@/components/gender-selection-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AgeRangeSlider } from "@/components/ui/age-range-slider";
import {
  CONNECT_WITH_OPTIONS,
  INTENTION_OPTIONS,
} from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { invalidatePlacesCache } from "@/modules/places/placesApi";
import { updateProfile } from "@/modules/profile/api";
import { setProfile } from "@/modules/store/slices/profileActions";
import { logger } from "@/utils/logger";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function FiltersScreen() {
  const colors = useThemeColors();
  const bottomSheet = useCustomBottomSheet();
  const { profile, isLoading: profileLoading } = useProfile();

  const [localFilters, setLocalFilters] = useState<{
    connectWith: string[];
    intentions: string[];
    ageRangeMin: number;
    ageRangeMax: number;
  }>({
    connectWith: profile?.connectWith ?? [],
    intentions: profile?.intentions ?? [],
    ageRangeMin: profile?.age_range_min ?? 18,
    ageRangeMax: profile?.age_range_max ?? 35,
  });

  const hasInitialized = useRef(false);
  const hasProfileSeeded = useRef(false);
  const skipNextSave = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we should skip age range from useEffect (will be saved via onSlidingComplete)
  const skipAgeFromEffect = useRef(false);

  const genderOptions = useMemo(() => {
    return CONNECT_WITH_OPTIONS.filter((o) => o.id !== "all").map((opt) => ({
      id: opt.id,
      label: t(opt.labelKey),
      key: opt.id,
    }));
  }, []);

  const intentionOptions = useMemo(() => {
    return INTENTION_OPTIONS.map((opt) => ({
      id: opt.id,
      label: t(opt.labelKey),
      key: opt.id,
    }));
  }, []);

  useEffect(() => {
    if (!profile || hasProfileSeeded.current) return;
    setLocalFilters({
      connectWith: profile.connectWith ?? [],
      intentions: profile.intentions ?? [],
      ageRangeMin: profile.age_range_min ?? 18,
      ageRangeMax: profile.age_range_max ?? 35,
    });
    hasProfileSeeded.current = true;
    skipNextSave.current = true; // hydration update should not trigger autosave
  }, [profile]);

  const genderLabel = useMemo(() => {
    if (!localFilters.connectWith.length) return "";
    return localFilters.connectWith
      .map((id) => genderOptions.find((g) => g.id === id)?.label)
      .filter(Boolean)
      .join(", ");
  }, [localFilters.connectWith, genderOptions]);

  const toggleConnectionType = (id: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      intentions: prev.intentions.includes(id)
        ? prev.intentions.filter((i) => i !== id)
        : [...prev.intentions, id],
    }));
  };

  const handleGenderConfirm = (selection: string[]) => {
    setLocalFilters((prev) => ({ ...prev, connectWith: selection }));
    bottomSheet?.close();
  };

  const handleOpenGenderSheet = () => {
    bottomSheet?.expand({
      content: () => (
        <GenderSelectionBottomSheetContent
          initialSelection={localFilters.connectWith}
          options={genderOptions}
          onConfirm={(sel) => handleGenderConfirm(sel)}
        />
      ),
    });
  };

  const scheduleSave = async (nextFilters: typeof localFilters) => {
    try {
      await updateProfile({
        connectWith: nextFilters.connectWith,
        intentions: nextFilters.intentions,
        ageRangeMin: nextFilters.ageRangeMin,
        ageRangeMax: nextFilters.ageRangeMax,
      });
      setProfile({
        ...profile,
        connectWith: nextFilters.connectWith,
        intentions: nextFilters.intentions,
        age_range_min: nextFilters.ageRangeMin,
        age_range_max: nextFilters.ageRangeMax,
      });
      // Invalidate places cache to refresh user previews with new filters
      invalidatePlacesCache();
    } catch (error) {
      logger.error("Auto-save filters failed", error);
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    // Skip if only age changed (will be saved via onSlidingComplete)
    if (skipAgeFromEffect.current) {
      skipAgeFromEffect.current = false;
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(() => scheduleSave(localFilters), 600);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [localFilters, profileLoading]);

  // Handler for when age slider is released
  const handleAgeSlidingComplete = ([min, max]: [number, number]) => {
    const newFilters = {
      ...localFilters,
      ageRangeMin: min,
      ageRangeMax: max,
    };
    setLocalFilters(newFilters);
    skipAgeFromEffect.current = true; // Don't re-trigger useEffect
    scheduleSave(newFilters);
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
          title={t("filters.title")}
        />
      }
    >
      <ThemedView>
        {/* Section 1: Gender */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("filters.gender.title")}
          </ThemedText>
          <ThemedText
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t("filters.gender.description")}
          </ThemedText>
          <Pressable
            onPress={handleOpenGenderSheet}
            style={[
              styles.selectButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.selectButtonText,
                {
                  color:
                    localFilters.connectWith.length === 0
                      ? colors.textSecondary
                      : colors.text,
                },
              ]}
            >
              {genderLabel}
            </ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>→</ThemedText>
          </Pressable>
        </View>

        {/* Section 2: Age Range */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("filters.age.title")}
          </ThemedText>
          <ThemedText
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t("filters.age.description")}
          </ThemedText>
          <View style={styles.ageRangeContainer}>
            <AgeRangeSlider
              min={18}
              max={100}
              value={[localFilters.ageRangeMin, localFilters.ageRangeMax]}
              onValueChange={([min, max]) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  ageRangeMin: min,
                  ageRangeMax: max,
                }))
              }
              onSlidingComplete={handleAgeSlidingComplete}
            />
          </View>
        </View>

        {/* Section 3: Connection Type */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("filters.connectionType.title")}
          </ThemedText>
          <ThemedText
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t("filters.connectionType.description")}
          </ThemedText>
          <View style={styles.connectionTypesContainer}>
            {intentionOptions.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => toggleConnectionType(type.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: localFilters.intentions.includes(type.id)
                      ? colors.accent
                      : colors.surface,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    ...typography.subheading,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  selectButtonText: {
    ...typography.body,
  },
  ageRangeContainer: {
    gap: spacing.lg,
  },
  connectionTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontWeight: "600",
  },
});
