import { ArrowRightIcon, CheckIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { SelectionCard } from "@/components/ui/selection-card";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import {
  getNextMissingField,
  PROFILE_FIELDS_ORDER,
} from "@/utils/profile-flow";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EDUCATION_OPTIONS = [
  { id: "", label: "Prefiro não informar" },
  {
    id: "high_school",
    label: "Ensino Médio",
    description: "Conclusão do ensino médio",
  },
  {
    id: "technical",
    label: "Técnico",
    description: "Curso técnico profissionalizante",
  },
  {
    id: "undergraduate",
    label: "Graduação",
    description: "Cursando ou concluído",
  },
  {
    id: "postgraduate",
    label: "Pós-graduação",
    description: "Especialização ou MBA",
  },
  { id: "masters", label: "Mestrado", description: "Mestrado acadêmico" },
  { id: "doctorate", label: "Doutorado", description: "Doutorado ou PhD" },
];

const ZODIAC_OPTIONS = [
  { id: "", label: "Prefiro não informar" },
  { id: "aries", label: "Áries" },
  { id: "taurus", label: "Touro" },
  { id: "gemini", label: "Gêmeos" },
  { id: "cancer", label: "Câncer" },
  { id: "leo", label: "Leão" },
  { id: "virgo", label: "Virgem" },
  { id: "libra", label: "Libra" },
  { id: "scorpio", label: "Escorpião" },
  { id: "sagittarius", label: "Sagitário" },
  { id: "capricorn", label: "Capricórnio" },
  { id: "aquarius", label: "Aquário" },
  { id: "pisces", label: "Peixes" },
];

const SMOKING_OPTIONS = [
  {
    id: "social",
    label: "Fumo socialmente",
    description: "Apenas em eventos ou ocasiões especiais",
  },
  { id: "no", label: "Eu não fumo", description: "Não sou fumante" },
  { id: "yes", label: "Eu fumo", description: "Fumante regular" },
  {
    id: "quitting",
    label: "Tentando parar de fumar",
    description: "Em processo de parar",
  },
];

const GENDER_OPTIONS = [
  { id: "female", label: "Mulher" },
  { id: "male", label: "Homem" },
  { id: "nonbinary", label: "Não binário" },
];

const RELATIONSHIP_OPTIONS = [
  { id: "single", label: "Solteiro(a)" },
  { id: "dating", label: "Namorando" },
  { id: "married", label: "Casado(a)" },
  { id: "open", label: "Relacionamento aberto" },
  { id: "complicated", label: "É complicado" },
];

export default function EditFieldScreen() {
  const { field } = useLocalSearchParams<{ field: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.data);
  const insets = useSafeAreaInsets();

  const [value, setValue] = useState<any>(
    profile ? (profile as any)[field] : ""
  );

  useEffect(() => {
    if (profile) {
      setValue((profile as any)[field] || "");
    }
  }, [field]);

  const handleSave = () => {
    if (profile) {
      const updatedProfile = { ...profile, [field]: value };
      dispatch(setProfile(updatedProfile));

      const nextFieldKey = getNextMissingField(field, updatedProfile);

      if (nextFieldKey) {
        if (nextFieldKey === "spots") {
          router.replace("/(tabs)/(profile)/edit/favorite-places");
        } else {
          router.setParams({ field: nextFieldKey });
        }
      } else {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleSkip = () => {
    const currentIndex = PROFILE_FIELDS_ORDER.indexOf(field);
    if (currentIndex !== -1 && currentIndex < PROFILE_FIELDS_ORDER.length - 1) {
      const nextField = PROFILE_FIELDS_ORDER[currentIndex + 1];
      if (nextField === "spots") {
        router.replace("/(tabs)/(profile)/edit/favorite-places");
      } else {
        router.setParams({ field: nextField });
      }
    } else {
      router.back();
    }
  };

  const renderContent = () => {
    switch (field) {
      case "bio":
      case "profession":
      case "hometown":
        return (
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              field === "bio" && styles.textArea,
            ]}
            value={value}
            onChangeText={setValue}
            placeholder={t(
              `screens.profile.profileEdit.profile.${field}Placeholder`
            )}
            placeholderTextColor={colors.textSecondary}
            multiline={field === "bio"}
            textAlignVertical={field === "bio" ? "top" : "center"}
            autoFocus
          />
        );

      case "height":
        return (
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            value={value?.toString()}
            onChangeText={(text) => setValue(Number(text))}
            placeholder="cm"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            autoFocus
          />
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
                label={option.label}
                description={(option as any).description}
                isSelected={value === option.id}
                onPress={() => setValue(option.id)}
              />
            ))}
          </View>
        );
      }

      case "languages":
        // TODO: Implement language selection
        return (
          <ThemedText style={{ color: colors.text }}>
            Language selection coming soon
          </ThemedText>
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
      case "hometown":
        return t("screens.profile.profileEdit.more.hometown");
      case "languages":
        return t("screens.profile.profileEdit.more.languages");
      case "zodiac":
        return t("screens.profile.profileEdit.more.zodiac");
      default:
        return t("screens.profile.profileEdit.title");
    }
  };

  const nextField = profile ? getNextMissingField(field, profile) : null;

  return (
    <BaseTemplateScreen
      isModal
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
      <ScrollView contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
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
