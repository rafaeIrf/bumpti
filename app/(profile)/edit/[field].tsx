import { ArrowRightIcon, CheckIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { LanguagesStep } from "@/components/profile-edit/languages-step";
import { LocationStep } from "@/components/profile-edit/location-step";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { InputText } from "@/components/ui/input-text";
import { SelectionCard } from "@/components/ui/selection-card";
import {
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  SMOKING_OPTIONS,
  ZODIAC_OPTIONS,
} from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { updateProfile } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";
import {
  getNextMissingField,
  PROFILE_FIELDS_ORDER,
} from "@/utils/profile-flow";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";

const HEIGHT_OPTIONS = [
  { label: "< 91 cm", value: 90 },
  ...Array.from({ length: 130 }, (_, i) => ({
    label: `${i + 91} cm`,
    value: i + 91,
  })),
  { label: "> 220 cm", value: 221 },
];

const FIELD_DB_KEYS: Record<string, string> = {
  education: "education_key",
  zodiac: "zodiac_key",
  smoking: "smoking_key",
  relationshipStatus: "relationship_key",
  height: "height_cm",
};

export default function EditFieldScreen() {
  const { field } = useLocalSearchParams<{ field: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.data);

  const getInitialValue = () => {
    if (!profile) {
      if (field === "profession") {
        return { jobTitle: "", companyName: "" };
      }
      if (field === "height") {
        return 150;
      }
      return "";
    }

    if (field === "profession") {
      return {
        jobTitle: (profile as any).job_title ?? "",
        companyName: (profile as any).company_name ?? "",
      };
    }

    const dbKey = FIELD_DB_KEYS[field] || field;
    const profileValue = (profile as any)[dbKey];

    if (field === "height" && !profileValue) {
      return 150;
    }

    return profileValue ?? "";
  };

  const [value, setValue] = useState<any>(getInitialValue);

  useEffect(() => {
    setValue(getInitialValue());
  }, [field, profile]);

  const handleSave = () => {
    if (profile) {
      let updatedProfile = { ...profile };
      let apiPayload: any = {};

      if (field === "profession") {
        const currentValue =
          (value as { jobTitle?: string; companyName?: string }) || {};
        const jobTitleValue =
          currentValue.jobTitle && currentValue.jobTitle.trim().length > 0
            ? currentValue.jobTitle.trim()
            : null;
        const companyNameValue =
          currentValue.companyName && currentValue.companyName.trim().length > 0
            ? currentValue.companyName.trim()
            : null;

        updatedProfile = {
          ...updatedProfile,
          job_title: jobTitleValue,
          company_name: companyNameValue,
        };
        apiPayload = {
          job_title: jobTitleValue,
          company_name: companyNameValue,
        };
      } else if (field === "location" && typeof value === "object") {
        // Handle location object update (merging multiple fields)
        updatedProfile = { ...updatedProfile, ...value };
        // Also update the legacy/display field if needed, though we should probably migrate to using city_name
        updatedProfile.location = value.location || value.city_name;
        apiPayload = { ...value };
      } else {
        const dbKey = FIELD_DB_KEYS[field] || field;

        updatedProfile = { ...updatedProfile, [dbKey]: value };
        apiPayload = { [dbKey]: value };
      }

      // Optimistic update
      dispatch(setProfile(updatedProfile));

      // Background API update
      updateProfile(apiPayload).catch((error) => {
        logger.error("Failed to update profile field", error);
      });

      const nextFieldKey = getNextMissingField(field, updatedProfile);

      if (nextFieldKey) {
        if (nextFieldKey === "spots") {
          router.replace("/main/favorite-places");
        } else {
          router.setParams({ field: nextFieldKey });
        }
      } else {
        // All fields complete - go back to edit profile
        router.replace("/(profile)/edit");
      }
    } else {
      router.replace("/(profile)/edit");
    }
  };

  const handleSkip = () => {
    const currentIndex = PROFILE_FIELDS_ORDER.indexOf(field);
    if (currentIndex !== -1 && currentIndex < PROFILE_FIELDS_ORDER.length - 1) {
      const nextField = PROFILE_FIELDS_ORDER[currentIndex + 1];
      if (nextField === "spots") {
        router.replace("/main/favorite-places");
      } else {
        router.setParams({ field: nextField });
      }
    } else {
      router.back();
    }
  };

  const renderContent = () => {
    switch (field) {
      case "profession": {
        const currentValue =
          (value as { jobTitle?: string; companyName?: string }) || {};
        const jobTitle = currentValue.jobTitle ?? "";
        const companyName = currentValue.companyName ?? "";

        return (
          <View style={{ gap: spacing.md }}>
            <InputText
              value={jobTitle}
              onChangeText={(text) => {
                setValue({ jobTitle: text, companyName });
              }}
              placeholder={t("screens.profile.profileEdit.lifestyle.jobTitle")}
              autoFocus
            />
            <InputText
              value={companyName}
              onChangeText={(text) => {
                setValue({ jobTitle, companyName: text });
              }}
              placeholder={t("screens.profile.profileEdit.lifestyle.company")}
            />
          </View>
        );
      }

      case "bio":
        return (
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              styles.textArea,
            ]}
            value={value}
            onChangeText={setValue}
            placeholder={t(
              `screens.profile.profileEdit.profile.${field}Placeholder`,
            )}
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            autoFocus
          />
        );

      case "location":
        return <LocationStep value={value} onChange={setValue} />;

      case "height":
        return (
          <View style={{ flex: 1 }}>
            <Picker
              selectedValue={value === "" ? null : value}
              onValueChange={(itemValue) => setValue(itemValue)}
              style={{
                color: colors.text,
                ...(Platform.OS === "android" && { height: 56 }),
              }}
              itemStyle={{
                color: colors.text,
                fontSize: 18,
              }}
              dropdownIconColor={colors.text}
              mode="dropdown"
            >
              <Picker.Item
                label={t("common.select")}
                value={null}
                color={colors.textSecondary}
              />
              {HEIGHT_OPTIONS.map((option) => (
                <Picker.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  color={colors.text}
                />
              ))}
            </Picker>
          </View>
        );

      case "education":
      case "zodiac":
      case "smoking":
      case "gender":
      case "relationshipStatus": {
        let options = RELATIONSHIP_OPTIONS;
        if (field === "education") options = EDUCATION_OPTIONS;
        else if (field === "zodiac") options = ZODIAC_OPTIONS;
        else if (field === "smoking") options = SMOKING_OPTIONS;
        else if (field === "gender") options = GENDER_OPTIONS;

        return (
          <View style={styles.optionsContainer}>
            {options.map((option) => (
              <SelectionCard
                key={option.id}
                label={t(option.labelKey)}
                description={
                  (option as any).descriptionKey
                    ? t((option as any).descriptionKey)
                    : undefined
                }
                isSelected={value === option.id}
                onPress={() => setValue(option.id)}
              />
            ))}
          </View>
        );
      }

      case "languages":
        return (
          <LanguagesStep
            selectedLanguages={Array.isArray(value) ? value : []}
            onLanguagesChange={setValue}
          />
        );

      case "spots":
        // Handled by separate screen
        return null;

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (field) {
      case "bio":
        return t("screens.profile.profileEdit.profile.bio");
      case "gender":
        return t("screens.profile.profileEdit.personalInfo.gender");
      case "relationshipStatus":
        return t("screens.profile.profileEdit.personalInfo.relationshipStatus");
      case "height":
        return t("screens.profile.profileEdit.personalInfo.height");
      case "profession":
        return t("screens.profile.profileEdit.lifestyle.profession");
      case "smoking":
        return t("screens.profile.profileEdit.lifestyle.smoking");
      case "education":
        return t("screens.profile.profileEdit.more.education");
      case "location":
        return t("screens.profile.profileEdit.more.location");
      case "languages":
        return t("screens.profile.edit.languages.title");
      case "zodiac":
        return t("screens.profile.profileEdit.more.zodiac");
      default:
        return t("screens.profile.profileEdit.title");
    }
  };

  const nextField = profile ? getNextMissingField(field, profile) : null;

  return (
    <BaseTemplateScreen
      useKeyboardAvoidingView
      isModal
      scrollEnabled={
        field !== "height" && field !== "languages" && field !== "location"
      }
      contentContainerStyle={styles.content}
      TopHeader={
        <ScreenToolbar
          title={getTitle()}
          leftAction={{
            icon: XIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
      BottomBar={
        <ScreenBottomBar
          variant="wizard"
          secondaryLabel={t("common.skip")}
          onSecondaryPress={handleSkip}
          onPrimaryPress={handleSave}
          primaryIcon={
            nextField ? (
              <ArrowRightIcon width={24} height={24} color="#FFF" />
            ) : (
              <CheckIcon width={24} height={24} color="#FFF" />
            )
          }
        />
      }
    >
      {renderContent()}
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 0,
  },
  input: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    ...typography.body,
  },
  textArea: {
    height: 120,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
});
