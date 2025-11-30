import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { GenderSelectionBottomSheetContent } from "@/components/gender-selection-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AgeRangeSlider } from "@/components/ui/age-range-slider";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingOptions } from "@/hooks/use-onboarding-options";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { updateProfile } from "@/modules/profile/api";
import { profileActions } from "@/modules/store/slices/profileActions";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function FiltersScreen() {
  const colors = useThemeColors();
  const { genders, intentions, isLoading } = useOnboardingOptions();
  const bottomSheet = useCustomBottomSheet();
  const { profile, isLoading: profileLoading } = useProfile();

  const [genderOptions, setGenderOptions] = useState<
    { id: number; label: string; key: string }[]
  >([]);
  const [intentionOptions, setIntentionOptions] = useState<
    { id: number; label: string; key: string }[]
  >([]);
  const [localFilters, setLocalFilters] = useState({
    connectWith: (profile?.connectWith ?? []).filter(
      (v) => typeof v === "number"
    ) as number[],
    intentions: (profile?.intentions ?? []).filter(
      (v) => typeof v === "number"
    ) as number[],
    ageRangeMin: profile?.age_range_min ?? 18,
    ageRangeMax: profile?.age_range_max ?? 35,
  });
  const hasInitialized = useRef(false);
  const hasProfileSeeded = useRef(false);
  const skipNextSave = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load options and sync with profile data
  // Load options from store first; fallback to remote fetch
  useEffect(() => {
    if (isLoading) return;
    setGenderOptions(
      genders.map((g) => ({
        id: g.id,
        label: t(`filters.gender.${g.key}`, g.key),
        key: g.key,
      }))
    );
    setIntentionOptions(
      intentions.map((i) => ({
        id: i.id,
        label: t(`filters.connectionType.${i.key}`, i.key),
        key: i.key,
      }))
    );
  }, [isLoading, genders, intentions]);

  useEffect(() => {
    if (!profile || hasProfileSeeded.current) return;
    setLocalFilters({
      connectWith: (profile.connectWith ?? []).filter(
        (v) => typeof v === "number"
      ) as number[],
      intentions: (profile.intentions ?? []).filter(
        (v) => typeof v === "number"
      ) as number[],
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

  const toggleConnectionType = (id: number) => {
    setLocalFilters((prev) => ({
      ...prev,
      intentions: prev.intentions.includes(id)
        ? prev.intentions.filter((i) => i !== id)
        : [...prev.intentions, id],
    }));
  };

  const handleGenderConfirm = (selection: number[]) => {
    setLocalFilters((prev) => ({ ...prev, connectWith: selection }));
    bottomSheet?.close();
  };

  const handleOpenGenderSheet = () => {
    bottomSheet?.expand({
      content: () => (
        <GenderSelectionBottomSheetContent
          initialSelection={localFilters.connectWith}
          options={genderOptions}
          onConfirm={(sel) => handleGenderConfirm(sel as number[])}
        />
      ),
    });
  };

  const scheduleSave = (nextFilters: typeof localFilters) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(async () => {
      try {
        const intentionMapByKey = new Map(
          intentionOptions.map((opt) => [opt.key, opt.id])
        );
        const sanitizedIntentions = nextFilters.intentions
          .map((val) =>
            typeof val === "number" ? val : intentionMapByKey.get(String(val))
          )
          .filter((v): v is number => typeof v === "number");

        const sanitizedConnectWith = nextFilters.connectWith.filter(
          (v): v is number => typeof v === "number"
        );

        await updateProfile({
          connectWith: sanitizedConnectWith,
          intentions: sanitizedIntentions,
          ageRangeMin: nextFilters.ageRangeMin,
          ageRangeMax: nextFilters.ageRangeMax,
        });
        profileActions.setProfile({
          ...profile,
          connectWith: sanitizedConnectWith,
          intentions: sanitizedIntentions,
          age_range_min: nextFilters.ageRangeMin,
          age_range_max: nextFilters.ageRangeMax,
        });
      } catch (error) {
        console.error("Auto-save filters failed", error);
      } finally {
      }
    }, 600); // debounce auto-save to reduce chatter
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
    scheduleSave(localFilters);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [localFilters, profileLoading]);

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
                      color: localFilters.intentions.includes(type.id)
                        ? "#000"
                        : colors.text,
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
