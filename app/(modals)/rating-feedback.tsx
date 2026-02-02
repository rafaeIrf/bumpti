import { StarIcon, XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";
import { t } from "@/modules/locales";
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

    // Buttons slide up
    buttonsTranslateY.value = withDelay(
      500,
      withSpring(0, {
        damping: 20,
        stiffness: 100,
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

  const handlePositiveFeedback = async () => {
    setIsSubmitting(true);

    try {
      await recordPositiveFeedback();
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
      setStage("thankYou");

      setTimeout(() => {
        router.dismissAll();
      }, 4000);
    } catch (error) {
      setIsSubmitting(false);
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
          <View
            style={[
              styles.choiceContainer,
              { paddingTop: insets.top + height * 0.15 },
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
          </View>
        )}

        {stage === "feedback" && (
          <View
            style={[
              styles.feedbackWrapper,
              { paddingTop: insets.top + height * 0.1 },
            ]}
          >
            {/* Skip button in top-right */}
            <Animated.View
              entering={FadeIn.duration(400).delay(200)}
              style={[styles.skipButton, { top: 24 }]}
            >
              <ActionButton
                icon={XIcon}
                onPress={() => router.dismissAll()}
                ariaLabel="Skip feedback"
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

              <Button
                variant="default"
                size="lg"
                fullWidth
                onPress={handleSubmitFeedback}
                loading={isSubmitting}
                label={t("feedback.modal.submit")}
                style={styles.submitButton}
              />
            </Animated.View>
          </View>
        )}

        {stage === "thankYou" && (
          <View style={styles.thankYouWrapper}>
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
          </View>
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
  feedbackWrapper: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  feedbackContainer: {
    flex: 1,
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
    marginTop: spacing.md,
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
