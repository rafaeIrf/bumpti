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
  "location",
  "zodiac",
];

const FIELD_DB_KEYS: Record<string, string> = {
  education: "education_key",
  zodiac: "zodiac_key",
  smoking: "smoking_key",
  relationshipStatus: "relationship_key",
  height: "height_cm",
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

export function navigateToNextProfileField(
  currentField: string,
  profile: ProfileData
) {
  const nextFieldKey = getNextMissingField(currentField, profile);

  if (nextFieldKey) {
    if (nextFieldKey === "spots") {
      router.replace("/(tabs)/(profile)/edit/favorite-places");
    } else {
      router.replace({
        pathname: "/(tabs)/(profile)/edit/[field]",
        params: { field: nextFieldKey },
      });
    }
    return;
  }

  // If no empty fields found, go back
  router.back();
}
