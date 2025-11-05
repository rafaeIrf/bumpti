import { CheckIcon } from "@/assets/icons";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ThemedText } from "./themed-text";
import { Button } from "./ui/button";

interface GenderIdentityBottomSheetProps {
  onSelect: (identity: string) => void;
  onClose: () => void;
}

export function GenderIdentityBottomSheet({
  onSelect,
  onClose,
}: GenderIdentityBottomSheetProps) {
  const colors = useThemeColors();
  const [selectedOption, setSelectedOption] = useState("");
  const [customGender, setCustomGender] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  const nonBinaryOptions = [
    "Agênero",
    "Andrógine",
    "Bigênero",
    "Demiboy",
    "Demigirl",
    "Genderfluid",
    "Genderqueer",
    "Não-binário",
    "Transmasculine",
    "Transfeminine",
    "Outro",
  ];

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    setShowOtherInput(false);
    setCustomGender("");
    setShowSuggestion(false);
    // Auto-confirm and close
    onSelect(option);
  };

  const handleConfirmCustom = () => {
    if (customGender.trim()) {
      onSelect(customGender.trim());
    }
  };

  const handleShowSuggestion = () => {
    setShowSuggestion(true);
    setShowOtherInput(false);
  };

  const handleSendSuggestion = () => {
    if (suggestion.trim()) {
      Alert.alert("Sucesso", t("screens.onboarding.genderSuggestionSuccess"));
      setSuggestion("");
      setShowSuggestion(false);
      onClose();
    }
  };

  if (showSuggestion) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.text }]}>
            {t("screens.onboarding.genderSuggestTitle")}
          </ThemedText>
          <ThemedText
            style={[styles.description, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.genderSuggestDescription")}
          </ThemedText>
        </View>

        <TextInput
          value={suggestion}
          onChangeText={setSuggestion}
          placeholder={t("screens.onboarding.genderSuggestPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              ...typography.body,
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          autoFocus
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View style={styles.actions}>
          <Button
            onPress={() => setShowSuggestion(false)}
            variant="outline"
            style={styles.actionButton}
          >
            {t("screens.onboarding.cancel")}
          </Button>
          <Button
            onPress={handleSendSuggestion}
            disabled={!suggestion.trim()}
            style={styles.actionButton}
          >
            {t("screens.onboarding.sendSuggestion")}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {t("screens.onboarding.genderSelectIdentity")}
        </ThemedText>
      </View>

      <View style={styles.optionsContainer}>
        {nonBinaryOptions.map((option) => (
          <Pressable
            key={option}
            onPress={() => handleOptionSelect(option)}
            style={[
              styles.option,
              {
                backgroundColor:
                  selectedOption === option
                    ? `${colors.accent}1A`
                    : colors.background,
                borderColor:
                  selectedOption === option ? colors.accent : colors.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.optionText,
                {
                  color:
                    selectedOption === option
                      ? colors.text
                      : colors.textSecondary,
                  fontWeight: selectedOption === option ? "600" : "400",
                },
              ]}
            >
              {option}
            </ThemedText>
            {selectedOption === option && (
              <CheckIcon width={20} height={20} color={colors.accent} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Input removido, 'Outro' agora é só uma opção como as demais */}

      <Pressable onPress={handleShowSuggestion} style={styles.suggestionLink}>
        <ThemedText style={[styles.suggestionText, { color: colors.accent }]}>
          {t("screens.onboarding.genderNotFound")}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    fontSize: 14,
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    ...typography.body,
    fontSize: 15,
  },
  customContainer: {
    marginTop: spacing.lg,
  },
  customLabel: {
    ...typography.caption,
    fontWeight: "500",
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmButton: {
    marginTop: spacing.sm,
  },
  suggestionLink: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    ...typography.caption,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
