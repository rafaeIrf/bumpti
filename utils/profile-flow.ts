import { ProfileData } from "@/modules/store/slices/profileSlice";
import { router } from "expo-router";

export const PROFILE_FIELDS_ORDER = [
  "bio",
  "gender",
  "relationshipStatus",
  "height",
  "profession",
  "smoking",
  "spots",
  "education",
  "university",
  "location",
  "languages",
  "zodiac",
];

const FIELD_DB_KEYS: Record<string, string> = {
  education: "education_key",
  zodiac: "zodiac_key",
  smoking: "smoking_key",
  relationshipStatus: "relationship_key",
  height: "height_cm",
  university: "university_id",
};

export function getNextMissingField(
  currentField: string,
  profile: ProfileData
): string | null {
  const currentIndex = PROFILE_FIELDS_ORDER.indexOf(currentField);
  const fieldsToCheck =
    currentIndex === -1
      ? PROFILE_FIELDS_ORDER
      : PROFILE_FIELDS_ORDER.slice(currentIndex + 1);

  for (const nextFieldKey of fieldsToCheck) {
    let isEmpty = false;

    if (nextFieldKey === "spots") {
      isEmpty = !profile.favoritePlaces || profile.favoritePlaces.length === 0;
    } else if (nextFieldKey === "languages") {
      isEmpty = !profile.languages || profile.languages.length === 0;
    } else if (nextFieldKey === "profession") {
      const jobTitle = (profile as any).job_title;
      const companyName = (profile as any).company_name;
      // Considered filled only when at least one of the fields has value
      isEmpty = !jobTitle && !companyName;
    } else {
      const dbKey = FIELD_DB_KEYS[nextFieldKey] || nextFieldKey;
      const val = profile[dbKey as keyof ProfileData];
      isEmpty = val === null || val === undefined || val === "";
    }

    if (isEmpty) {
      return nextFieldKey;
    }
  }
  return null;
}

// Fields that are full screens (not modals)
// NOTE: spots and university are now modals too (but full-screen modals with their own toolbar/bottom bar)
const SCREEN_FIELDS = ["spots", "university"];

// Check if a field is a screen-like modal or a simple field modal
function isScreenField(field: string): boolean {
  return SCREEN_FIELDS.includes(field);
}

export function navigateToNextProfileField(
  currentField: string,
  profile: ProfileData
) {
  const nextFieldKey = getNextMissingField(currentField, profile);

  if (nextFieldKey) {
    const currentIsScreen = isScreenField(currentField);

    // All within the same (profile) stack now - much simpler!
    if (nextFieldKey === "spots") {
      // Navigate to favorite-places modal
      if (currentIsScreen) {
        // Screen-like modal → Screen-like modal: replace
        router.replace("/(profile)/favorite-places");
      } else {
        // Simple modal → Screen-like modal: replace
        router.replace("/(profile)/favorite-places");
      }
    } else if (nextFieldKey === "university") {
      // Navigate to university modal
      if (currentIsScreen) {
        // Screen-like modal → Screen-like modal: replace
        router.replace("/(profile)/university");
      } else {
        // Simple modal → Screen-like modal: replace
        router.replace("/(profile)/university");
      }
    } else {
      // Navigate to simple field modal
      if (currentIsScreen) {
        // Screen-like modal → Simple modal: replace to field modal
        router.replace({
          pathname: "/(profile)/edit/[field]",
          params: { field: nextFieldKey },
        });
      } else {
        // Simple modal → Simple modal: just update params
        router.setParams({ field: nextFieldKey });
      }
    }
    return;
  }

  // If no empty fields found, go back to edit profile
  router.back();
}
