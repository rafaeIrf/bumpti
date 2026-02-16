import { useOnboardingSteps } from "@/hooks/use-onboarding-steps";
import { useAppSelector } from "@/modules/store/hooks";
import { isIOS } from "@/utils";
import React, { createContext, useContext, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";

interface OnboardingProgressContextValue {
  progress: any; // SharedValue<number>
  prevStepRef: React.MutableRefObject<number>;
  /** 1-based current step position (0 if not found) */
  currentStep: number;
  /** Total number of trackable steps */
  totalSteps: number;
}

const OnboardingProgressContext =
  createContext<OnboardingProgressContextValue | null>(null);

export function OnboardingProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const progress = useSharedValue(0);
  const prevStepRef = useRef(0);

  const { shouldShowLocation, shouldShowNotifications, isLoading } =
    useOnboardingSteps();
  const { completedSteps, currentStep: reduxCurrentStep } = useAppSelector(
    (state) => state.onboarding,
  );

  // Freeze steps ONCE after permission hooks settle (they start as false while async)
  // Once frozen, immune to permission changes and completedSteps growing mid-flow
  const stepsRef = useRef<string[]>([]);
  const frozenRef = useRef(false);

  if (!frozenRef.current) {
    const base = [
      "user-name",
      "user-age",
      "user-gender",
      "connect-with",
      "intention",
      "user-photos",
      "user-bio",
      "interests",
    ];
    if (shouldShowLocation) base.push("location");
    base.push("favorite-places");
    base.push("university");
    if (shouldShowNotifications) base.push("notifications");
    if (isIOS) base.push("tracking");

    stepsRef.current = base.filter(
      (step) => !completedSteps.includes(step as any),
    );
    if (!isLoading) {
      frozenRef.current = true;
    }
  }

  const steps = stepsRef.current;

  const stepIndex = steps.indexOf(reduxCurrentStep);
  const currentStep = stepIndex >= 0 ? stepIndex + 1 : 0;
  const totalSteps = steps.length;

  return (
    <OnboardingProgressContext.Provider
      value={{ progress, prevStepRef, currentStep, totalSteps }}
    >
      {children}
    </OnboardingProgressContext.Provider>
  );
}

export function useOnboardingProgress() {
  const context = useContext(OnboardingProgressContext);
  if (!context) {
    throw new Error(
      "useOnboardingProgress must be used within OnboardingProgressProvider",
    );
  }
  return context;
}
