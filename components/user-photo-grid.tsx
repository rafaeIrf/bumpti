import { XIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PhotoActionsBottomSheet } from "@/components/photo-actions-bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useImagePicker } from "@/hooks/use-image-picker";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Sortable from "react-native-sortables";

interface UserPhotoGridProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  minPhotos?: number;
  showInfo?: boolean;
  isUploading?: boolean;
}

export function UserPhotoGrid({
  photos,
  onPhotosChange,
  maxPhotos = 9,
  minPhotos = 3,
  showInfo = true,
  isUploading = false,
}: UserPhotoGridProps) {
  const colors = useThemeColors();
  const { isLoading, pickFromLibrary } = useImagePicker();
  const { expand, close } = useCustomBottomSheet();
  const { width } = useWindowDimensions();
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const [isDragging, setIsDragging] = useState(false);

  // Calculate item dimensions
  const containerPadding = spacing.md * 2;
  const columnGap = spacing.sm;
  const rowGap = spacing.md;
  const columns = 3;
  const itemWidth =
    (width - containerPadding - (columns - 1) * columnGap) / columns;
  const itemHeight = itemWidth * (4 / 3);

  // Calculate total height for the container
  const totalRows = Math.ceil(maxPhotos / columns);
  const containerHeight = totalRows * itemHeight + (totalRows - 1) * rowGap;

  const remainingPhotos = Math.max(0, minPhotos - photos.length);

  const handleAddPhoto = async () => {
    const currentPhotos = photosRef.current;
    if (currentPhotos.length >= maxPhotos) return;

    try {
      const remainingSlots = maxPhotos - currentPhotos.length;

      const result = await pickFromLibrary({
        aspect: [3, 4],
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (result.success && result.uris) {
        // Use the latest photos from ref to ensure we have the correct state
        // even if a removal happened recently
        onPhotosChange([...photosRef.current, ...result.uris]);
      } else if (result.error === "permission_denied") {
        Alert.alert(
          t("common.error"),
          t("components.userPhotoGrid.permissionDenied")
        );
      }
    } catch (error) {
      logger.error("Erro ao adicionar foto:", error);
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
          const newPhotos = [...photosRef.current];
          newPhotos[index] = newUri;
          onPhotosChange(newPhotos);
        }
      }
    } catch (error) {
      logger.error("Erro ao substituir foto:", error);
    }
  };

  const handlePhotoAction = (index: number) => {
    const currentPhotos = photosRef.current;
    const canRemove = currentPhotos.length > minPhotos;

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
            onPhotosChange(photosRef.current.filter((_, i) => i !== index));
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

  // Only photos are sortable
  const sortableData = photos.map((uri) => ({ key: uri, uri, type: "photo" }));

  const renderStaticItems = () => {
    const items = [];
    const startIndex = photos.length;

    // Loading or Add button
    if (isUploading) {
      items.push({ type: "loading", index: startIndex });
    } else if (photos.length < maxPhotos) {
      items.push({ type: "add", index: startIndex });
    }

    // Empty slots
    const nextIndex =
      startIndex + (isUploading || photos.length < maxPhotos ? 1 : 0);
    for (let i = nextIndex; i < maxPhotos; i++) {
      items.push({ type: "empty", index: i });
    }

    return items.map((item) => {
      const row = Math.floor(item.index / columns);
      const col = item.index % columns;
      const left = col * (itemWidth + columnGap);
      const top = row * (itemHeight + rowGap);

      return (
        <View
          key={`static-${item.index}`}
          style={{
            position: "absolute",
            left,
            top,
            width: itemWidth,
            height: itemHeight,
            zIndex: 2,
          }}
        >
          {renderStaticItemContent(item.type, item.index)}
        </View>
      );
    });
  };

  const renderStaticItemContent = (type: string, index: number) => {
    const itemStyle = { width: "100%", height: "100%" };

    if (type === "loading") {
      return (
        <View
          style={[
            styles.addPhotoButton,
            itemStyle,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      );
    }

    if (type === "add") {
      return (
        <Pressable
          onPress={handleAddPhoto}
          disabled={isLoading}
          style={[
            styles.addPhotoButton,
            itemStyle,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Ionicons
                name="camera-outline"
                size={32}
                color={colors.textSecondary}
              />
              {index === 0 && (
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
      );
    }

    // Empty
    return (
      <View
        style={[
          styles.addPhotoButton,
          itemStyle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: 0.5,
          },
        ]}
      />
    );
  };

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const itemStyle = { width: itemWidth, height: itemHeight };

      return (
        <View style={[styles.photoContainer, itemStyle]}>
          <View style={styles.photoWrapper}>
            <Image
              source={item.uri}
              style={styles.photo}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
            />
            {index === 0 && (
              <View
                style={[styles.mainBadge, { backgroundColor: colors.accent }]}
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
        </View>
      );
    },
    [colors, itemWidth, itemHeight]
  );

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = ({ data }: { data: typeof sortableData }) => {
    setIsDragging(false);
    const newPhotos = data.map((item) => item.uri);
    onPhotosChange(newPhotos);
  };

  return (
    <View>
      <View style={[styles.gridContainer, { height: containerHeight }]}>
        {renderStaticItems()}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: isDragging ? 3 : 1,
          }}
        >
          <Sortable.Grid
            key={`grid-${photos.length}`}
            columns={3}
            data={sortableData}
            renderItem={renderItem}
            columnGap={spacing.sm}
            rowGap={spacing.md}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </View>
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
    marginBottom: spacing.lg,
  },
  photoContainer: {
    // Dimensions set dynamically
  },
  photoWrapper: {
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
    // Dimensions set dynamically
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
