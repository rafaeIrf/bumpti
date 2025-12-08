import { XIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PhotoActionsBottomSheet } from "@/components/photo-actions-bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useImagePicker } from "@/hooks/use-image-picker";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

interface UserPhotoGridProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  minPhotos?: number;
  showInfo?: boolean;
}

export function UserPhotoGrid({
  photos,
  onPhotosChange,
  maxPhotos = 9,
  minPhotos = 3,
  showInfo = true,
}: UserPhotoGridProps) {
  const colors = useThemeColors();
  const { isLoading, pickFromLibrary } = useImagePicker();
  const { expand, close } = useCustomBottomSheet();

  const remainingPhotos = Math.max(0, minPhotos - photos.length);

  const handleAddPhoto = async () => {
    if (photos.length >= maxPhotos) return;

    try {
      const remainingSlots = maxPhotos - photos.length;

      const result = await pickFromLibrary({
        aspect: [3, 4],
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (result.success && result.uris) {
        onPhotosChange([...photos, ...result.uris]);
      } else if (result.error === "permission_denied") {
        Alert.alert(
          t("common.error"),
          t("components.userPhotoGrid.permissionDenied")
        );
      }
    } catch (error) {
      console.error("Erro ao adicionar foto:", error);
      Alert.alert(
        t("common.error"),
        t("components.userPhotoGrid.addPhotoError")
      );
    }
  };

  const handleReplacePhoto = async (index: number) => {
    try {
      // Small delay to ensure bottom sheet is closed before opening picker
      await new Promise((resolve) => setTimeout(resolve, 300));

      const result = await pickFromLibrary({
        aspect: [3, 4],
        quality: 0.8,
        allowsEditing: true,
        allowsMultipleSelection: false,
      });

      if (result.success) {
        const newUri = result.uri || (result.uris && result.uris[0]);
        if (newUri) {
          const newPhotos = [...photos];
          newPhotos[index] = newUri;
          onPhotosChange(newPhotos);
        }
      }
    } catch (error) {
      console.error("Erro ao substituir foto:", error);
    }
  };

  const handlePhotoAction = (index: number) => {
    const canRemove = photos.length > minPhotos;

    expand({
      content: () => (
        <PhotoActionsBottomSheet
          canRemove={canRemove}
          onReplace={() => {
            close();
            handleReplacePhoto(index);
          }}
          onRemove={() => {
            close();
            onPhotosChange(photos.filter((_, i) => i !== index));
          }}
          onAdd={() => {
            close();
            handleAddPhoto();
          }}
          onCancel={() => close()}
        />
      ),
    });
  };

  const slots = Array(maxPhotos).fill(null);

  return (
    <View>
      <View style={styles.gridContainer}>
        {slots.map((_, index) => (
          <View key={index} style={styles.photoSlot}>
            {photos[index] ? (
              <>
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
                </View>
                <Pressable
                  style={[
                    styles.removeButton,
                    {
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handlePhotoAction(index)}
                >
                  <XIcon width={20} height={20} color="#FFFFFF" />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleAddPhoto}
                disabled={photos.length >= maxPhotos || isLoading}
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

      {showInfo && (
        <View style={styles.infoContainer}>
          <ThemedText
            style={[styles.photoCount, { color: colors.textSecondary }]}
          >
            {t("screens.onboarding.photosCount", { count: photos.length })} •{" "}
            {t("screens.onboarding.photosMinimum")}
          </ThemedText>

          {photos.length < minPhotos && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
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
    fontWeight: "600",
    fontSize: 12,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
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
  },
  infoContainer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  photoCount: {
    ...typography.body,
    textAlign: "center",
  },
  errorText: {
    ...typography.caption,
    textAlign: "center",
  },
});
