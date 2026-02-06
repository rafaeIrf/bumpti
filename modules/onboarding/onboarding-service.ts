import { processProfileImage } from "@/modules/media/image-processor";
import { OnboardingUserData } from "@/modules/store/slices/onboardingSlice";
import { supabase } from "@/modules/supabase/client";
import { trackOnboardingComplete } from "../analytics";



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
  connectWith?: string[];
  intentions?: string[];
  photos?: { url: string; position: number }[];
  bio?: string | null;
};

// getOnboardingOptions removed

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
  
  if (userData.bio) {
    formData.append("bio", userData.bio);
  }

  // University data (name/lat/lng come from places table via university_id FK)
  if (userData.universityId) {
    formData.append("universityId", userData.universityId);
  }
  if (userData.universityNameCustom) {
    formData.append("universityNameCustom", userData.universityNameCustom);
  }
  if (userData.graduationYear !== undefined && userData.graduationYear !== null) {
    formData.append("graduationYear", String(userData.graduationYear));
  }
  // Default show_university_on_home to true if university is set
  if (userData.universityId || userData.universityNameCustom) {
    formData.append("showUniversityOnHome", String(userData.showUniversityOnHome ?? true));
  }

  // Interests
  if (userData.interests?.length) {
    formData.append("interests", JSON.stringify(userData.interests));
  }

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

  // Track onboarding completion analytics event
  trackOnboardingComplete();
}
