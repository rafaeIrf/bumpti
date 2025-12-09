import { SearchIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { LANGUAGE_CODES } from "@/constants/language-codes";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

interface LanguagesStepProps {
  selectedLanguages: string[];
  onLanguagesChange: (languages: string[]) => void;
}

export function LanguagesStep({
  selectedLanguages,
  onLanguagesChange,
}: LanguagesStepProps) {
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState("");
  const translateLanguage = (code: string) => {
    const key = `languages.${code}`;
    const translated = t(key);
    return translated && translated !== key ? translated : code;
  };
  const localeLanguages = React.useMemo(
    () =>
      LANGUAGE_CODES.map((code) => ({
        id: code,
        name: translateLanguage(code),
      })),
    []
  );

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD") // separa letras dos acentos
      .replaceAll(/[\u0300-\u036f]/g, "") // remove os acentos
      .toLowerCase();
  };

  const filteredLanguages = localeLanguages.filter((lang) =>
    normalizeText(lang.name).includes(normalizeText(searchQuery))
  );

  const handleToggleLanguage = (langId: string) => {
    if (selectedLanguages.includes(langId)) {
      onLanguagesChange(selectedLanguages.filter((id) => id !== langId));
    } else {
      if (selectedLanguages.length >= 6) return;
      onLanguagesChange([...selectedLanguages, langId]);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginBottom: spacing.md }}>
        <ThemedText style={[typography.body, { color: colors.textSecondary }]}>
          {selectedLanguages.length} {t("common.of")} 6
        </ThemedText>
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <InputText
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("common.search")}
          leftIcon={SearchIcon}
          onClear={() => setSearchQuery("")}
          containerStyle={{ flex: 0 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.chipsContainer}
        showsVerticalScrollIndicator={false}
      >
        {filteredLanguages.map((lang) => {
          const isSelected = selectedLanguages.includes(lang.id);
          return (
            <Button
              key={lang.id}
              variant="outline"
              size="sm"
              label={lang.name}
              onPress={() => handleToggleLanguage(lang.id)}
              style={{
                borderColor: isSelected ? colors.accent : colors.border,
              }}
              textStyle={{
                color: isSelected ? colors.accent : colors.textSecondary,
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
