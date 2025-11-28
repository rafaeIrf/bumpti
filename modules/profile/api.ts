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
};

export type UpdateProfilePayload = {
  name?: string;
  birthdate?: string;
  genderId?: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  intentions?: number[];
  connectWith?: number[];
  bio?: string;
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
