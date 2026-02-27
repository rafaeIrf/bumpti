import { XIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { PhotoActionsBottomSheet } from "@/components/photo-actions-bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useImagePicker } from "@/hooks/use-image-picker";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { imageToBase64, isRemoteUri } from "@/modules/media/image-processor";
import {
  moderateProfilePhoto,
  moderateProfilePhotosBatch,
} from "@/modules/moderation";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import Sortable from "react-native-sortables";

// ============================================================================
// Types
// ============================================================================

interface UserPhotoGridProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  /** Called with a map of localUri → SHA-256 hash when new photos are approved */
  onPhotoHashesChange?: (hashes: Record<string, string>) => void;
  /** Current map of uri → hash for already-added photos (used for content-level dedup) */
  photoHashes?: Record<string, string>;
  maxPhotos?: number;
  minPhotos?: number;
  showInfo?: boolean;
  isUploading?: boolean;
}

interface PhotoItem {
  key: string;
  uri: string;
}

interface StaticItem {
  type: "loading" | "add" | "empty";
  index: number;
}

interface ErrorModalState {
  visible: boolean;
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

const COLUMNS = 3;
const ASPECT_RATIO = 4 / 3;
const BORDER_RADIUS = 18;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generates a stable key for a photo URI.
 * Handles duplicate URIs by appending occurrence index.
 */
function generatePhotoKey(uri: string, occurrenceIndex: number): string {
  const urlWithoutQuery = uri.split("?")[0];
  const filename = urlWithoutQuery.split("/").pop() || uri;

  // Simple hash for additional uniqueness
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    hash = (hash << 5) - hash + uri.charCodeAt(i);
    hash |= 0;
  }

  return occurrenceIndex > 0
    ? `${filename}-${hash}-${occurrenceIndex}`
    : `${filename}-${hash}`;
}

/**
 * Checks if a URI is a local file (not yet uploaded).
 */
function isLocalUri(uri: string): boolean {
  return uri.startsWith("file://") || uri.startsWith("ph://");
}

// ============================================================================
// Component
// ============================================================================

export function UserPhotoGrid({
  photos,
  onPhotosChange,
  onPhotoHashesChange,
  photoHashes = {},
  maxPhotos = 9,
  minPhotos = 2,
  showInfo = true,
  isUploading = false,
}: UserPhotoGridProps) {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const { pickFromLibrary } = useImagePicker();
  const { expand, close } = useCustomBottomSheet();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    visible: false,
    message: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Ref to access latest photos in callbacks without stale closures
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------
  const containerPadding = spacing.md * 2;
  const columnGap = spacing.sm;
  const rowGap = spacing.md;

  const itemWidth =
    (screenWidth - containerPadding - (COLUMNS - 1) * columnGap) / COLUMNS;
  const itemHeight = itemWidth * ASPECT_RATIO;

  const totalRows = Math.ceil(maxPhotos / COLUMNS);
  const containerHeight = totalRows * itemHeight + (totalRows - 1) * rowGap;

  const remainingPhotos = Math.max(0, minPhotos - photos.length);
  const showLoading = isUploading || isProcessing;
  const canAddMore = photos.length < maxPhotos && !showLoading;

  // ---------------------------------------------------------------------------
  // Memoized Data
  // ---------------------------------------------------------------------------
  const sortableData = useMemo<PhotoItem[]>(() => {
    const uriOccurrences: Record<string, number> = {};

    return photos.map((uri) => {
      const occurrence = uriOccurrences[uri] || 0;
      uriOccurrences[uri] = occurrence + 1;

      return {
        key: generatePhotoKey(uri, occurrence),
        uri,
      };
    });
  }, [photos]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const showError = useCallback((message: string) => {
    setErrorModal({ visible: true, message });
  }, []);

  const hideError = useCallback(() => {
    setErrorModal({ visible: false, message: "" });
  }, []);

  const handleAddPhoto = useCallback(async () => {
    if (isProcessing || isUploading) return;

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

      // User cancelled
      if (!result.success || !result.uris || result.uris.length === 0) {
        if (result.error === "permission_denied") {
          showError(t("components.userPhotoGrid.permissionDenied"));
        }
        return;
      }

      setIsProcessing(true);

      const newUris = result.uris;
      const approvedUris: string[] = [];
      let rejectedCount = 0;

      // Separate remote (already approved) from local (need moderation)
      const remoteUris = newUris.filter(isRemoteUri);
      const localUris = newUris.filter((uri) => !isRemoteUri(uri));

      // Remote images don't need moderation
      approvedUris.push(...remoteUris);

      // Process local images with batch moderation (single API call)
      if (localUris.length > 0) {
        try {
          // Convert all local images to base64 in parallel
          const base64Images = await Promise.all(
            localUris.map((uri) => imageToBase64(uri, 0.7)),
          );

          // Use batch moderation for multiple images (1 API call instead of N)
          if (base64Images.length > 1) {
            const batchResult = await moderateProfilePhotosBatch(base64Images);

            // Build set of existing hashes to detect content-level duplicates
            const existingHashSet = new Set(Object.values(photoHashes));
            const approvedHashes: Record<string, string> = {};
            for (let i = 0; i < localUris.length; i++) {
              const item = batchResult.results[i];
              if (item?.approved) {
                // Skip if same image content already in grid
                if (item.hash && existingHashSet.has(item.hash)) {
                  rejectedCount++;
                  continue;
                }
                approvedUris.push(localUris[i]);
                if (item.hash) {
                  approvedHashes[localUris[i]] = item.hash;
                  existingHashSet.add(item.hash); // prevent two identical picks in same batch
                }
              } else {
                rejectedCount++;
              }
            }
            if (onPhotoHashesChange && Object.keys(approvedHashes).length > 0) {
              onPhotoHashesChange(approvedHashes);
            }
          } else {
            // Single image - use regular moderation
            const modResult = await moderateProfilePhoto(base64Images[0]);
            if (modResult.approved) {
              // Skip if same image content already in grid
              const existingHashSet = new Set(Object.values(photoHashes));
              if (modResult.hash && existingHashSet.has(modResult.hash)) {
                rejectedCount++;
              } else {
                approvedUris.push(localUris[0]);
                if (modResult.hash && onPhotoHashesChange) {
                  onPhotoHashesChange({ [localUris[0]]: modResult.hash });
                }
              }
            } else {
              rejectedCount++;
            }
          }
        } catch (modError) {
          logger.warn("Moderation failed, allowing photos:", modError);
          approvedUris.push(...localUris);
        }
      }

      // Update photos if any were approved
      if (approvedUris.length > 0) {
        const existing = new Set(photosRef.current);
        const dedupedUris = approvedUris.filter((uri) => !existing.has(uri));
        if (dedupedUris.length === 0) return;
        const finalPhotos = [...photosRef.current, ...dedupedUris].slice(
          0,
          maxPhotos,
        );
        onPhotosChange(finalPhotos);
      }

      // Show error if any were rejected
      if (rejectedCount > 0) {
        const hasApprovedPhotos = approvedUris.length > 0;
        showError(
          hasApprovedPhotos
            ? t("moderation.somePhotosRejected")
            : rejectedCount === 1
              ? t("moderation.photoRejected")
              : t("moderation.photosRejected", { count: rejectedCount }),
        );
      }
    } catch (error) {
      logger.error("Error adding photo:", error);
      showError(t("components.userPhotoGrid.addPhotoError"));
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    isUploading,
    maxPhotos,
    pickFromLibrary,
    showError,
    onPhotosChange,
    onPhotoHashesChange,
    photoHashes,
  ]);

  const handleReplacePhoto = useCallback(
    async (index: number) => {
      try {
        // Delay to ensure bottom sheet closes before picker opens
        await new Promise((resolve) => setTimeout(resolve, 300));

        const result = await pickFromLibrary({
          aspect: [3, 4],
          quality: 0.8,
          allowsEditing: true,
          allowsMultipleSelection: false,
        });

        if (!result.success) return;

        const newUri = result.uri || result.uris?.[0];
        if (!newUri) return;

        // Moderate if local file
        if (!isRemoteUri(newUri)) {
          try {
            const base64 = await imageToBase64(newUri, 0.7);
            const modResult = await moderateProfilePhoto(base64);

            if (!modResult.approved) {
              showError(t("moderation.photoRejected"));
              return;
            }
            if (modResult.hash && onPhotoHashesChange) {
              onPhotoHashesChange({ [newUri]: modResult.hash });
            }
          } catch (modError) {
            logger.warn("Moderation failed, allowing photo:", modError);
          }
        }

        const newPhotos = [...photosRef.current];
        newPhotos[index] = newUri;
        onPhotosChange(newPhotos);
      } catch (error) {
        logger.error("Error replacing photo:", error);
      }
    },
    [pickFromLibrary, showError, onPhotosChange, onPhotoHashesChange],
  );

  const handleRemovePhoto = useCallback(
    (index: number) => {
      onPhotosChange(photosRef.current.filter((_, i) => i !== index));
    },
    [onPhotosChange],
  );

  const handlePhotoAction = useCallback(
    (index: number) => {
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
              handleRemovePhoto(index);
            }}
            onAdd={() => {
              close();
              handleAddPhoto();
            }}
            onCancel={() => close()}
          />
        ),
      });
    },
    [
      minPhotos,
      expand,
      close,
      handleReplacePhoto,
      handleRemovePhoto,
      handleAddPhoto,
    ],
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: PhotoItem[] }) => {
      setIsDragging(false);
      const newPhotos = data.map((item) => item.uri);
      onPhotosChange(newPhotos);
    },
    [onPhotosChange],
  );

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------
  const getStaticItems = useCallback((): StaticItem[] => {
    const items: StaticItem[] = [];
    const startIndex = photos.length;

    // Loading or Add button
    if (photos.length < maxPhotos) {
      if (isUploading || isProcessing) {
        items.push({ type: "loading", index: startIndex });
      } else {
        items.push({ type: "add", index: startIndex });
      }
    }

    // Empty slots
    const nextIndex = startIndex + (photos.length < maxPhotos ? 1 : 0);
    for (let i = nextIndex; i < maxPhotos; i++) {
      items.push({ type: "empty", index: i });
    }

    return items;
  }, [photos.length, maxPhotos, isUploading, isProcessing]);

  const renderStaticItemContent = useCallback(
    (type: StaticItem["type"]) => {
      const baseStyle: ViewStyle = {
        ...styles.addPhotoButton,
        backgroundColor: colors.surface,
        borderColor: colors.border,
      };

      if (type === "loading") {
        return (
          <View style={[baseStyle, styles.centeredContent]}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        );
      }

      if (type === "add") {
        return (
          <Pressable
            onPress={handleAddPhoto}
            disabled={!canAddMore}
            style={baseStyle}
          >
            {showLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name="camera-outline"
                size={32}
                color={colors.textSecondary}
              />
            )}
          </Pressable>
        );
      }

      // Empty slot
      return <View style={[baseStyle, styles.emptySlot]} />;
    },
    [colors, handleAddPhoto, canAddMore, showLoading],
  );

  const renderStaticItems = useCallback(() => {
    const items = getStaticItems();

    return items.map((item) => {
      const row = Math.floor(item.index / COLUMNS);
      const col = item.index % COLUMNS;
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
          {renderStaticItemContent(item.type)}
        </View>
      );
    });
  }, [
    getStaticItems,
    itemWidth,
    itemHeight,
    columnGap,
    rowGap,
    renderStaticItemContent,
  ]);

  const renderPhotoItem = useCallback(
    ({ item, index }: { item: PhotoItem; index: number }) => {
      const isLocal = isLocalUri(item.uri);

      return (
        <View style={{ width: itemWidth, height: itemHeight }}>
          <View style={styles.photoWrapper}>
            <RemoteImage
              key={item.key}
              source={{ uri: item.uri }}
              style={styles.photo}
              contentFit="cover"
              cachePolicy={isLocal ? "none" : "memory-disk"}
              transition={0}
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
    [itemWidth, itemHeight, colors, handlePhotoAction],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
            columns={COLUMNS}
            data={sortableData}
            renderItem={renderPhotoItem}
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

      <ConfirmationModal
        isOpen={errorModal.visible}
        onClose={hideError}
        title={t("common.error")}
        description={errorModal.message}
        actions={[
          {
            label: t("common.understood"),
            onPress: hideError,
          },
        ]}
      />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  gridContainer: {
    marginBottom: spacing.lg,
  },
  photoWrapper: {
    width: "100%",
    height: "100%",
    borderRadius: BORDER_RADIUS,
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
    borderRadius: BORDER_RADIUS,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  centeredContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptySlot: {
    opacity: 0.5,
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
