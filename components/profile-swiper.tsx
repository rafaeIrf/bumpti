import { UsersIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { UserProfileCard } from "./user-profile-card";

interface ProfileSwiperProps {
  readonly profiles: ActiveUserAtPlace[];
  readonly currentPlaceId?: string;
  readonly places?: Record<string, { name: string; emoji: string }>;
  readonly onLike?: (profile: ActiveUserAtPlace) => void;
  readonly onPass?: (profile: ActiveUserAtPlace) => void;
  readonly onComplete?: () => void;
  readonly onIndexChange?: (index: number) => void;
  readonly emptyStateTitle?: string;
  readonly emptyStateDescription?: string;
  readonly emptyStateAction?: {
    label: string;
    onClick: () => void;
  };
}

export interface ProfileSwiperRef {
  handleLike: () => void;
  handleDislike: () => void;
  handleSkip: () => void; // Local skip (no API call)
  triggerSwipeLike: () => void;
  triggerSwipeSkip: () => void;
  getSwipeX: () => SharedValue<number>;
}

const SWIPE_THRESHOLD = 50; // Reduzido de 100 para 50 - mais fácil de swipe
const ROTATION_MULTIPLIER = 0.15;

export const ProfileSwiper = forwardRef<ProfileSwiperRef, ProfileSwiperProps>(
  (
    {
      profiles,
      currentPlaceId,
      places,
      onLike,
      onPass,
      onComplete,
      onIndexChange,
      emptyStateTitle,
      emptyStateDescription,
      emptyStateAction,
    },
    ref
  ) => {
    const colors = useThemeColors();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
    const [showConnectAnimation, setShowConnectAnimation] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [connectedName, setConnectedName] = useState("");
    const [isTransitioning, setIsTransitioning] = useState(false);
    const currentProfileIdRef = useRef<string | null>(null);

    const translateX = useSharedValue(0);
    const swipeDirection = useSharedValue<"none" | "like" | "skip">("none");

    const currentProfile = profiles[currentIndex];

    useEffect(() => {
      currentProfileIdRef.current = currentProfile?.user_id ?? null;
    }, [currentProfile?.user_id]);

    useEffect(() => {
      const currentId = currentProfileIdRef.current;
      if (!currentId) return;
      const newIndex = profiles.findIndex((profile) => profile.user_id === currentId);
      if (newIndex >= 0 && newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }, [currentIndex, profiles]);

    const handleLike = useCallback(() => {
      if (!currentProfile) return;

      setIsTransitioning(true);
      setLikedProfiles([...likedProfiles, currentProfile.id]);
      setConnectedName(currentProfile.name);

      // Show connect animation
      setShowConnectAnimation(true);
      setTimeout(() => setShowConnectAnimation(false), 800);

      // Show toast
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);

      // Callback
      onLike?.(currentProfile);

      // Next profile with smooth delay
      const nextIndex = currentIndex + 1;
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setIsTransitioning(false);

        if (nextIndex >= profiles.length) {
          onComplete?.();
        }
      }, 350); // Delay para suavizar transição
    }, [
      currentProfile,
      likedProfiles,
      currentIndex,
      profiles.length,
      onLike,
      onComplete,
    ]);

    const handleDislike = useCallback(() => {
      if (!currentProfile) return;

      setIsTransitioning(true);
      onPass?.(currentProfile);

      // Next profile with smooth delay
      const nextIndex = currentIndex + 1;
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setIsTransitioning(false);

        if (nextIndex >= profiles.length) {
          onComplete?.();
        }
      }, 350); // Delay para suavizar transição
    }, [currentProfile, currentIndex, profiles.length, onPass, onComplete]);

    const handleSkip = useCallback(() => {
      if (!currentProfile) return;

      setIsTransitioning(true);
      // No onPass call here - pure skip (e.g. for blocking)

      // Next profile with smooth delay
      const nextIndex = currentIndex + 1;
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setIsTransitioning(false);

        if (nextIndex >= profiles.length) {
          onComplete?.();
        }
      }, 350); // Delay para suavizar transição
    }, [currentProfile, currentIndex, profiles.length, onComplete]);

    // Monitor swipe direction changes
    useEffect(() => {
      const checkSwipe = setInterval(() => {
        if (swipeDirection.value === "like") {
          swipeDirection.value = "none";
          handleLike();
        } else if (swipeDirection.value === "skip") {
          swipeDirection.value = "none";
          handleDislike(); // Swipe left implies dislike
        }
      }, 100);

      return () => clearInterval(checkSwipe);
    }, [swipeDirection, handleLike, handleDislike]);

    // Reset translateX when currentIndex changes (new profile)
    useEffect(() => {
      translateX.value = 0;
    }, [currentIndex, translateX]);

    useEffect(() => {
      onIndexChange?.(currentIndex);
    }, [currentIndex, onIndexChange]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      handleLike,
      handleDislike,
      handleSkip,
      triggerSwipeLike: handleLike,
      triggerSwipeSkip: handleDislike, // X button triggers dislike
      getSwipeX: () => translateX,
    }));

    const panGesture = Gesture.Pan()
      .activeOffsetX([-10, 10]) // Apenas ativa se mover horizontalmente
      .failOffsetY([-10, 10]) // Falha se mover verticalmente
      .onUpdate((event) => {
        // Apenas atualiza translação horizontal
        translateX.value = event.translationX;
      })
      .onEnd((event) => {
        const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
        const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;

        if (shouldSwipeRight || shouldSwipeLeft) {
          // Set direction for polling to pick up
          swipeDirection.value = shouldSwipeRight ? "like" : "skip";

          // Animate out - don't reset position in callback
          translateX.value = withTiming(shouldSwipeRight ? 1000 : -1000, {
            duration: 350,
          });
        } else {
          // Return to center
          translateX.value = withSpring(0);
        }
      });

    const animatedCardStyle = useAnimatedStyle(() => {
      const rotation = translateX.value * ROTATION_MULTIPLIER;

      return {
        transform: [
          { translateX: translateX.value },
          { rotate: `${rotation}deg` },
        ],
        opacity: 1,
      };
    });

    // Animated style for the card behind - scales up as front card moves
    const animatedCardBehindStyle = useAnimatedStyle(() => {
      const progress = Math.min(Math.abs(translateX.value) / 100, 1);
      const scale = 0.95 + progress * 0.05; // 0.95 -> 1.0
      const opacity = progress; // 0 -> 1.0 (only visible when dragging)

      return {
        transform: [{ scale }],
        opacity,
        zIndex: -1, // Ensure it stays behind
      };
    });

    // Empty state - no more profiles OR transitioning out of last profile
    if (currentIndex >= profiles.length) {
      return (
        <View
          style={[
            styles.emptyStateContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.emptyStateContent}>
            <View
              style={[
                styles.emptyStateIcon,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <UsersIcon width={48} height={48} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              {emptyStateTitle || t("profileSwiper.emptyStateTitle")}
            </Text>
            <Text
              style={[
                styles.emptyStateDescription,
                { color: colors.textSecondary },
              ]}
            >
              {emptyStateDescription ||
                t("profileSwiper.emptyStateDescription")}
            </Text>
            {emptyStateAction && (
              <Button
                onPress={emptyStateAction.onClick}
                style={styles.emptyStateButton}
              >
                {emptyStateAction.label}
              </Button>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Connect animation overlay */}
        {showConnectAnimation && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.connectAnimationOverlay}
          >
            {/* Ícone removido */}
          </Animated.View>
        )}

        {/* Toast notification */}
        {showToast && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={[styles.toast, { backgroundColor: colors.accent }]}
          >
            {/* Ícone removido */}
            <Text style={styles.toastText}>
              {t("profileSwiper.connectedWith", { name: connectedName })}
            </Text>
          </Animated.View>
        )}

        {/* Profile cards - Stack effect */}
        <View style={styles.cardContainer}>
          {/* Next profile (behind) */}
          {profiles[currentIndex + 1] && (
            <Animated.View
              style={[styles.card, styles.cardBehind, animatedCardBehindStyle]}
            >
              <UserProfileCard
                profile={profiles[currentIndex + 1]}
                currentPlaceId={currentPlaceId}
                places={places}
              />
            </Animated.View>
          )}

          {/* Current profile (front) */}
          {currentProfile && (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.card, animatedCardStyle]}>
                <UserProfileCard
                  profile={currentProfile}
                  currentPlaceId={currentPlaceId}
                  places={places}
                  onBlockSuccess={handleSkip}
                />
              </Animated.View>
            </GestureDetector>
          )}
        </View>
      </View>
    );
  }
);

ProfileSwiper.displayName = "ProfileSwiper";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 400,
  },
  cardBehind: {
    position: "absolute",
    width: "100%",
    maxWidth: 400,
    top: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  emptyStateContent: {
    alignItems: "center",
    maxWidth: 400,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyStateDescription: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    marginTop: spacing.md,
  },
  connectAnimationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    pointerEvents: "none",
  },
  connectEmoji: {
    fontSize: 120,
  },
  toast: {
    position: "absolute",
    top: 100,
    left: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastEmoji: {
    fontSize: 20,
  },
  toastText: {
    ...typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
