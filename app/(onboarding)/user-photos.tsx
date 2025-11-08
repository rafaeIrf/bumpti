import { ArrowLeftIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useImagePicker } from "@/hooks/use-image-picker";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function UserPhotosScreen() {
  const colors = useThemeColors();
  const [photos, setPhotos] = useState<string[]>([]);
  const { isLoading, pickFromLibrary } = useImagePicker();
  const { shouldShowScreen: shouldShowLocation } = useLocationPermission();
  const { shouldShowScreen: shouldShowNotifications } =
    useNotificationPermission();

  const handleAddPhoto = async () => {
    if (photos.length >= 9) return;

    try {
      const remainingSlots = 9 - photos.length;
      
      // Usar seleção múltipla de imagens
      const result = await pickFromLibrary({
        aspect: [3, 4],
        quality: 0.8,
        allowsEditing: false, // Desabilitar edição para seleção múltipla
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (result.success && result.uris) {
        setPhotos([...photos, ...result.uris]);
      } else if (result.error === "permission_denied") {
        Alert.alert(
          t("common.error"),
          "Precisamos de permissão para acessar suas fotos"
        );
      }
    } catch (error) {
      console.error("Erro ao adicionar foto:", error);
      Alert.alert(t("common.error"), "Não foi possível adicionar a foto");
    }
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert(
      "Remover foto",
      "Deseja remover esta foto?",
      [
        { text: t("screens.onboarding.cancel"), style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            setPhotos(photos.filter((_, i) => i !== index));
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleContinue = () => {
    if (photos.length >= 3) {
      // TODO: Save photos to user profile
      console.log("Photos to save:", photos);

      // Navegar baseado nas permissões pendentes
      if (shouldShowLocation) {
        router.push("/(onboarding)/location");
      } else if (shouldShowNotifications) {
        router.push("/(onboarding)/notifications");
      } else {
        router.push("/(onboarding)/complete");
      }
    }
  };

  const slots = Array(9).fill(null);
  const remainingPhotos = Math.max(0, 3 - photos.length);

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("screens.onboarding.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={photos.length < 3}
        />
      }
    >
      <ThemedText style={[styles.heading, { color: colors.text }]}>
        {t("screens.onboarding.photosTitle")}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("screens.onboarding.photosSubtitle")}
      </ThemedText>

      <View style={styles.gridContainer}>
        {slots.map((_, index) => (
          <View key={index} style={styles.photoSlot}>
            {photos[index] ? (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: photos[index] }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                {index === 0 && (
                  <View
                    style={[
                      styles.mainBadge,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <ThemedText style={styles.mainBadgeText}>
                      {t("screens.onboarding.photosMainLabel")}
                    </ThemedText>
                  </View>
                )}
                <Pressable
                  onPress={() => handleRemovePhoto(index)}
                  style={[
                    styles.removeButton,
                    { backgroundColor: colors.error },
                  ]}
                >
                  <XIcon width={20} height={20} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleAddPhoto}
                disabled={photos.length >= 9 || isLoading}
                style={[
                  styles.addPhotoButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {isLoading && index === photos.length ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <>
                    <Ionicons
                      name="camera-outline"
                      size={32}
                      color={colors.textSecondary}
                    />
                    {index === 0 && photos.length === 0 && (
                      <ThemedText
                        style={[
                          styles.addPhotoLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t("screens.onboarding.photosMainLabel")}
                      </ThemedText>
                    )}
                  </>
                )}
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <ThemedText
          style={[styles.photoCount, { color: colors.textSecondary }]}
        >
          <ThemedText
            style={[
              styles.photoCountNumber,
              {
                color: photos.length >= 3 ? colors.accent : colors.text,
                fontWeight: "600",
              },
            ]}
          >
            {photos.length}
          </ThemedText>{" "}
          {t("screens.onboarding.photosCount", { count: photos.length })} •{" "}
          {t("screens.onboarding.photosMinimum")}
        </ThemedText>

        {photos.length < 3 && (
          <ThemedText style={[styles.errorText, { color: colors.error }]}>
            {remainingPhotos === 1
              ? t("screens.onboarding.photosAddMore", {
                  count: remainingPhotos,
                })
              : t("screens.onboarding.photosAddMorePlural", {
                  count: remainingPhotos,
                })}
          </ThemedText>
        )}
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.heading,
    fontSize: 26,
    marginBottom: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    marginBottom: spacing.xl,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  photoSlot: {
    width: "31.5%",
    aspectRatio: 3 / 4,
    marginBottom: spacing.md,
  },
  photoContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  mainBadge: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mainBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  removeButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addPhotoButton: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  addPhotoLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  infoContainer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  photoCount: {
    ...typography.body,
    fontSize: 14,
    textAlign: "center",
  },
  photoCountNumber: {
    fontSize: 14,
  },
  errorText: {
    ...typography.caption,
    fontSize: 13,
    textAlign: "center",
  },
});
