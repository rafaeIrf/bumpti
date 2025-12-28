import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { StarRating } from "@/components/star-rating";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { VibeSelector } from "@/components/vibe-selector";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { saveSocialReview } from "@/modules/places/api"; // Added import
import { PlaceVibe } from "@/modules/places/types";
import { logger } from "@/utils/logger";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RatePlaceScreen() {
  const { placeId, name, category } = useLocalSearchParams<{
    placeId: string;
    name: string;
    category: string;
  }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [selectedVibes, setSelectedVibes] = useState<PlaceVibe[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleVibe = (vibe: PlaceVibe) => {
    setSelectedVibes((prev) => {
      if (prev.includes(vibe)) {
        return prev.filter((v) => v !== vibe);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, vibe];
    });
  };

  const handleSave = async () => {
    if (rating === 0) return;

    try {
      setIsSaving(true);
      await saveSocialReview({
        placeId,
        rating,
        selectedVibes,
      });

      router.back();
    } catch (error) {
      logger.error("Failed to save review:", error);
      Alert.alert(
        t("common.error"),
        t("screens.ratePlace.errorMessage", {
          defaultValue:
            "Não foi possível salvar sua avaliação. Tente novamente.",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <BaseTemplateScreen
      isModal
      statusBarStyle="light"
      containerStyle={{ backgroundColor: "#000000" }} // Pure black background per "Dark Social" spec
      TopHeader={
        <View style={[styles.header, { paddingTop: spacing.sm }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={styles.closeButton}
          >
            <XIcon width={24} height={24} color="#FFFFFF" />
          </Pressable>
        </View>
      }
      BottomBar={
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <Button
            onPress={handleSave}
            disabled={rating === 0}
            style={[styles.saveButton, rating === 0 && { opacity: 0.5 }]}
            textStyle={styles.saveButtonText}
            loading={isSaving}
          >
            {t("actions.save_rating")}
          </Button>
        </View>
      }
    >
      <View style={styles.content}>
        {/* Header Info */}
        <View style={styles.placeInfo}>
          <ThemedText style={styles.placeName}>
            {name ||
              t("screens.ratePlace.defaultName", { defaultValue: "Local" })}
          </ThemedText>
          <ThemedText style={styles.placeCategory}>
            {category ||
              t("screens.ratePlace.defaultCategory", {
                defaultValue: "Categoria",
              })}
          </ThemedText>
          <ThemedText style={styles.helperText}>
            {t("screens.ratePlace.header.helper")}
          </ThemedText>
        </View>

        {/* Star Rating */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {t("screens.ratePlace.rating.question")}
          </ThemedText>
          <View style={styles.ratingWrapper}>
            <StarRating rating={rating} onRatingChange={setRating} size={48} />
            {/* {rating > 0 && (
              <Animated.View entering={FadeIn} existing={FadeOut}>
                <ThemedText style={styles.ratingValue}>
                  {rating.toFixed(1)}
                </ThemedText>
              </Animated.View>
            )} */}
          </View>
        </View>

        {/* Vibe Tags */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {t("screens.ratePlace.vibes.question")}
          </ThemedText>
          <VibeSelector
            selectedVibes={selectedVibes}
            onToggleVibe={handleToggleVibe}
          />
        </View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    alignItems: "flex-end",
  },
  closeButton: {
    padding: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  content: {
    paddingTop: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  placeInfo: {
    alignItems: "center",
    gap: 4,
  },
  placeName: {
    ...typography.heading,
    fontSize: 24,
    color: "#FFFFFF",
    textAlign: "center",
  },
  placeCategory: {
    ...typography.body,
    color: "#666666",
    fontSize: 16,
  },
  helperText: {
    ...typography.caption,
    color: "#999999",
    marginTop: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: "#FFFFFF",
    textAlign: "center",
  },
  ratingWrapper: {
    alignItems: "center",
    gap: spacing.sm,
  },
  ratingValue: {
    ...typography.heading,
    color: "#2997FF",
    fontSize: 24,
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
  },
  saveButton: {
    backgroundColor: "#2997FF",
    height: 56,
    borderRadius: 28,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
