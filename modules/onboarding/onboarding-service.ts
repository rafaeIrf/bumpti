import { processProfileImage } from "@/modules/media/image-processor";
import { OnboardingUserData } from "@/modules/store/slices/onboardingSlice";
import { supabase } from "@/modules/supabase/client";

export type OnboardingOption = { id: number; key: string };

export type ProfilePayload = {
  id: string;
  name: string | null;
  birthdate?: string | null;
  gender: string | null;
  gender_id?: number | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  created_at?: string;
  updated_at?: string;
  connectWith?: number[];
  intentions?: number[];
  photos?: { url: string; position: number }[];
  bio?: string | null;
};

export async function getOnboardingOptions(): Promise<{
  genders: OnboardingOption[];
  intentions: OnboardingOption[];
}> {
  const { data, error } = await supabase.functions.invoke("get-onboarding-options");

  if (error) {
    throw new Error(error.message || "Não foi possível carregar as opções.");
  }

  const payload =
    (data as Partial<{ genders: OnboardingOption[]; intentions: OnboardingOption[] }>) ??
    {};

  return {
    genders: Array.isArray(payload.genders) ? payload.genders : [],
    intentions: Array.isArray(payload.intentions) ? payload.intentions : [],
  };
}

export async function saveOnboarding(userData: OnboardingUserData) {
  const allowedGenders = ["male", "female", "non-binary"];
  const gender =
    typeof userData.gender === "string" && allowedGenders.includes(userData.gender)
      ? userData.gender
      : null;

  // Prefer birthdate only
  const birthdate =
    typeof userData.birthdate === "string" ? userData.birthdate : null;

  const formData = new FormData();
  formData.append("name", userData.name ?? "");
  formData.append("birthdate", birthdate ?? "");
  formData.append("gender", gender ?? "");
  formData.append(
    "connectWith",
    JSON.stringify(userData.connectWith ?? [])
  );
  formData.append(
    "intentions",
    JSON.stringify(userData.intentions ?? [])
  );
  formData.append(
    "favoritePlaces",
    JSON.stringify(userData.favoritePlaces ?? [])
  );

  if (userData.photoUris?.length) {
    const processedPhotos = await Promise.all(
      userData.photoUris.map((uri, index) =>
        processProfileImage(uri, `photo-${index}.jpg`)
      )
    );

    processedPhotos.forEach((photo) => {
      formData.append("photos", {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as any);
    });
  }

  const { error } = await supabase.functions.invoke("save-onboarding", {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível salvar seus dados.");
  }
}
