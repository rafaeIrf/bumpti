import { useAppSelector } from "@/modules/store/hooks";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { OnboardingStep } from "@/modules/store/slices/onboardingSlice";
import { useRouter } from "expo-router";

// Define the step order and routes
const STEP_ORDER: OnboardingStep[] = [
  "phone-auth",
  "verify-code",
  "user-name",
  "user-age",
  "user-gender",
  "connect-with",
  "intention",
  "user-photos",
  "location",
  "notifications",
  "complete",
];

// Map step names to routes
const STEP_ROUTES: Record<OnboardingStep, string> = {
  "phone-auth": "/(onboarding)/phone-auth",
  "verify-code": "/(onboarding)/verify-code",
  "user-name": "/(onboarding)/user-name",
  "user-age": "/(onboarding)/user-age",
  "user-gender": "/(onboarding)/user-gender",
  "connect-with": "/(onboarding)/connect-with",
  intention: "/(onboarding)/intention",
  "user-photos": "/(onboarding)/user-photos",
  location: "/(onboarding)/location",
  notifications: "/(onboarding)/notifications",
  complete: "/(onboarding)/complete",
};

export function useOnboardingFlow() {
  const router = useRouter();
  const { currentStep, completedSteps, userData } = useAppSelector(
    (state) => state.onboarding
  );

  // Get the next step in the flow
  const getNextStep = (step: OnboardingStep): OnboardingStep | null => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex === -1 || currentIndex === STEP_ORDER.length - 1) {
      return null;
    }
    return STEP_ORDER[currentIndex + 1];
  };

  // Complete the current step and navigate to next
  const completeCurrentStep = (step: OnboardingStep) => {
    onboardingActions.completeStep(step);

    const nextStep = getNextStep(step);
    if (nextStep) {
      onboardingActions.setCurrentStep(nextStep);
      router.push(STEP_ROUTES[nextStep] as any);
    } else {
      // Onboarding is complete
      onboardingActions.completeOnboarding();
      router.replace("/(tabs)/(home)");
    }
  };

  return {
    currentStep,
    completedSteps,
    userData,
    completeCurrentStep,
    getNextStep,
  };
}
