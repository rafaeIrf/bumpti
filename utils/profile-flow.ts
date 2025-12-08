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
  "hometown",
  "zodiac",
];

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
    } else {
      const val = profile[nextFieldKey as keyof ProfileData];
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
