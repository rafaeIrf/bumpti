import { processProfileImage } from "@/modules/media/image-processor";
import { supabase } from "@/modules/supabase/client";
import { PostgrestError } from "@supabase/supabase-js";

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
  favoritePlaces?: any[] | null;
  profession?: string | null;
  education_key?: string | null;
  location?: string | null;
  languages?: string[] | null;
  zodiac_key?: string | null;
  relationship_key?: string | null;
  smoking_key?: string | null;
  height_cm?: number | null;
};

export type UpdateProfilePayload = {
  name?: string;
  birthdate?: string;
  gender?: string;
  ageRangeMin?: number;
  ageRangeMax?: number;
  intentions?: number[];
  connectWith?: number[];
  bio?: string;
  education_key?: string;
  zodiac_key?: string;
  smoking_key?: string;
  relationship_key?: string;
  height_cm?: number;
  [key: string]: unknown;
};

export async function getProfile(): Promise<ProfilePayload | null> {
  const { data, error } = await supabase.functions.invoke("get-profile");

  if (error) {
    throw new Error(error.message || "Não foi possível carregar seu perfil.");
  }

  return (data?.profile ?? null) as ProfilePayload | null;
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const { data, error } = await supabase.functions.invoke<{
    profile: ProfilePayload;
  }>("update-profile", {
    body: payload,
  });

  if (error) {
    throw error as PostgrestError;
  }

  return data?.profile;
}

export async function updateProfilePhotos(photos: string[]) {
  const formData = new FormData();

  for (let i = 0; i < photos.length; i++) {
    const photoUri = photos[i];

    if (photoUri.startsWith("http") || photoUri.startsWith("https")) {
      // Existing photo URL
      formData.append("photos", photoUri);
    } else {
      // New local photo
      const processed = await processProfileImage(photoUri, `photo-${i}.jpg`);
      formData.append("photos", {
        uri: processed.uri,
        name: processed.name,
        type: processed.type,
      } as any);
    }
  }

  const { data, error } = await supabase.functions.invoke<{
    profile: ProfilePayload;
  }>("update-profile", {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível atualizar as fotos.");
  }

  return data?.profile;
}
