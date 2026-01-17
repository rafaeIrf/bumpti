import { hasLocationPermission } from "@/modules/location";
import { hasNotificationPermission } from "@/modules/notifications";
import { useAppSelector } from "@/modules/store/hooks";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { OnboardingStep } from "@/modules/store/slices/onboardingSlice";
import { useRouter } from "expo-router";

// Define the step order and routes
const STEP_ORDER: OnboardingStep[] = [
  "user-name",
  "user-age",
  "user-gender",
  "connect-with",
  "intention",
  "user-photos",
  "favorite-places",
  "location",
  "notifications",
  "complete",
];

// Map step names to routes
const STEP_ROUTES: Record<OnboardingStep, string> = {
  "user-name": "/(onboarding)/user-name",
  "user-age": "/(onboarding)/user-age",
  "user-gender": "/(onboarding)/user-gender",
  "connect-with": "/(onboarding)/connect-with",
  intention: "/(onboarding)/intention",
  "user-photos": "/(onboarding)/user-photos",
  "favorite-places": "/(onboarding)/favorite-places",
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
  const resolveNextStep = async (
    step: OnboardingStep | null
  ): Promise<OnboardingStep | null> => {
    let next = step;

    while (next) {
      console.log('next',next)
      if (next === "location") {
        const granted = await hasLocationPermission();
        if (granted) {
          onboardingActions.setLocationPermission(true);
          onboardingActions.completeStep("location");
          next = getNextStep("location");
          continue;
        }
      }

      if (next === "notifications") {
        const granted = await hasNotificationPermission();
        if (granted) {
          onboardingActions.setNotificationPermission(true);
          onboardingActions.completeStep("notifications");
          next = getNextStep("notifications");
          continue;
        }
      }

      break;
    }

    return next;
  };

  const completeCurrentStep = async (step: OnboardingStep) => {
    onboardingActions.completeStep(step);

    const nextStep = await resolveNextStep(getNextStep(step));
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
