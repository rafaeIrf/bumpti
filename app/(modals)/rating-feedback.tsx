import { StarIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";
import { t } from "@/modules/locales";
import { isIOS } from "@/utils";
import type { RatingTriggerType } from "@/utils/rating-service";
import {
  recordNegativeFeedback,
  recordPositiveFeedback,
} from "@/utils/rating-service";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

type Stage = "choice" | "feedback" | "thankYou";

export default function RatingFeedbackModal() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ trigger?: RatingTriggerType }>();

  const [stage, setStage] = useState<Stage>("choice");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const iconTranslateY = useSharedValue(-100);
  const iconScale = useSharedValue(0.5);
  const textOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(100);
  const contentOpacity = useSharedValue(1);

  useEffect(() => {
    // Icon smooth entrance
    iconTranslateY.value = withSpring(0, {
      damping: 20,
      stiffness: 100,
    });
    iconScale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });

    // Start very subtle linear floating animation after entrance
    setTimeout(() => {
      iconTranslateY.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 1200, easing: Easing.linear }),
          withTiming(0, { duration: 1200, easing: Easing.linear }),
        ),
        -1,
        true,
      );
    }, 1000);

    // Text fade in
    textOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));

    // Buttons slide up - faster and smoother with timing
    buttonsTranslateY.value = withDelay(
      400,
      withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [iconTranslateY, iconScale, textOpacity, buttonsTranslateY]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: iconTranslateY.value },
      { scale: iconScale.value },
    ],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  const contentOpacityStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handlePositiveFeedback = async () => {
    setIsSubmitting(true);

    try {
      recordPositiveFeedback();
      router.dismissAll();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNegativeFeedback = () => {
    setStage("feedback");
  };

  const handleSubmitFeedback = async () => {
    setIsSubmitting(true);

    try {
      await recordNegativeFeedback(message.trim() || undefined);

      // Fade out current content
      contentOpacity.value = withTiming(0, { duration: 300 });

      // Wait for fade out, then change stage
      setTimeout(() => {
        setStage("thankYou");
        // Fade in new content
        contentOpacity.value = withTiming(1, { duration: 400 });
      }, 300);

      setTimeout(() => {
        router.dismissAll();
      }, 1500);
    } catch (error) {
      setIsSubmitting(false);
      contentOpacity.value = 1;
    }
  };

  // Determine title based on trigger type
  const title =
    params.trigger === "first_match"
      ? t("feedback.modal.titleFirstMatch")
      : t("feedback.modal.titleRetention");

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#0A0A0A", "#000000"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        {/* Decorative blur blobs */}
        <View style={styles.blobContainer}>
          <View style={[styles.blob, styles.blob1]} />
          <View style={[styles.blob, styles.blob2]} />
        </View>

        {/* Content */}
        {stage === "choice" && (
          <Animated.View
            style={[
              styles.choiceContainer,
              { paddingTop: insets.top + height * 0.15 },
              contentOpacityStyle,
            ]}
          >
            {/* Animated icon */}
            <Animated.View style={iconAnimatedStyle}>
              <BrandIcon icon={StarIcon} size="xl" withShadow />
            </Animated.View>

            {/* Animated text */}
            <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              <ThemedText style={styles.subtitle}>
                Sua avaliação nos ajuda a conectar mais pessoas na vida real.
              </ThemedText>
            </Animated.View>

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Animated buttons */}
            <Animated.View
              style={[styles.buttonsContainer, buttonsAnimatedStyle]}
            >
              <Button
                variant="default"
                size="lg"
                fullWidth
                onPress={handlePositiveFeedback}
                loading={isSubmitting}
                label={t("feedback.modal.positiveButton")}
                style={styles.primaryButton}
              />
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onPress={handleNegativeFeedback}
                disabled={isSubmitting}
                label={t("feedback.modal.negativeButton")}
                textStyle={styles.secondaryButtonText}
              />
            </Animated.View>
          </Animated.View>
        )}

        {stage === "feedback" && (
          <Animated.View style={[{ flex: 1 }, contentOpacityStyle]}>
            <BaseTemplateScreen
              scrollEnabled={true}
              isModal
              useKeyboardAvoidingView={true}
              ignoreBottomSafeArea={true}
              contentContainerStyle={{
                paddingTop: isIOS ? insets.top : insets.top + spacing.md * 2,
              }}
              BottomBar={
                <ScreenBottomBar
                  primaryLabel={t("feedback.modal.submit")}
                  onPrimaryPress={handleSubmitFeedback}
                  primaryDisabled={isSubmitting}
                  showBorder={false}
                />
              }
            >
              {/* Skip button in top-right */}
              <Animated.View
                entering={FadeIn.duration(400).delay(200)}
                style={[styles.skipButton, { top: spacing.md }]}
                pointerEvents="box-none"
              >
                <ActionButton
                  icon={XIcon}
                  onPress={() => router.dismissAll()}
                  ariaLabel={t("feedback.modal.skipFeedback")}
                  size="sm"
                  variant="default"
                />
              </Animated.View>

              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.feedbackContainer}
              >
                <ThemedText style={styles.feedbackTitle}>
                  {t("feedback.modal.feedbackQuestion")}
                </ThemedText>

                <InputText
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t("feedback.modal.feedbackPlaceholder")}
                  multiline
                  maxLength={500}
                  showCharacterCounter
                  containerStyle={styles.inputContainer}
                  autoFocus
                />
              </Animated.View>
            </BaseTemplateScreen>
          </Animated.View>
        )}

        {stage === "thankYou" && (
          <Animated.View style={[styles.thankYouWrapper, contentOpacityStyle]}>
            <Animated.View
              entering={FadeIn.duration(600)}
              style={styles.thankYouContainer}
            >
              <BrandIcon icon={StarIcon} size="xl" withShadow />
              <ThemedText style={styles.thankYouTitle}>
                {t("feedback.modal.thankYouTitle")}
              </ThemedText>
              <ThemedText style={styles.thankYouSubtitle}>
                {t("feedback.modal.thankYouMessage")}
              </ThemedText>
            </Animated.View>
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  blobContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#1D9BF0",
    opacity: 0.08,
  },
  blob1: {
    width: 300,
    height: 300,
    top: height * 0.1,
    right: -100,
    transform: [{ scale: 1.5 }],
  },
  blob2: {
    width: 250,
    height: 250,
    bottom: height * 0.2,
    left: -80,
  },
  choiceContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  textContainer: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  primaryButton: {
    minHeight: 56,
  },
  secondaryButtonText: {
    color: "rgba(255, 255, 255, 0.5)",
  },
  feedbackContainer: {
    gap: spacing.lg,
  },
  feedbackTitle: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  inputContainer: {
    flex: 0,
  },
  submitButton: {
    minHeight: 56,
  },
  thankYouWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  thankYouContainer: {
    alignItems: "center",
    gap: spacing.xl,
  },
  thankYouTitle: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  thankYouSubtitle: {
    ...typography.body,
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },
  skipButton: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 10,
  },
});
