import { processProfileImage } from "@/modules/media/image-processor";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { PostgrestError } from "@supabase/supabase-js";
import { NotificationSettings } from "./types";

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
  favoritePlaces?: any[] | null;
  job_title?: string | null;
  company_name?: string | null;
  education_key?: string | null;
  location?: string | null;
  languages?: string[] | null;
  zodiac_key?: string | null;
  relationship_key?: string | null;
  smoking_key?: string | null;
  height_cm?: number | null;
  verification_status?: "unverified" | "pending" | "verified" | "rejected" | null;
  is_invisible?: boolean | null;
  filter_only_verified?: boolean | null;
  subscription?: any;
  notification_settings?: NotificationSettings;
  university_id?: string | null;
  university_name_custom?: string | null;
  // These come from places table via JOIN in get-profile
  university_name?: string | null;
  university_lat?: number | null;
  university_lng?: number | null;
  university_active_users?: number | null;
  graduation_year?: number | null;
  show_university_on_home?: boolean | null;
};

export type UpdateProfilePayload = {
  name?: string;
  birthdate?: string;
  gender?: string;
  ageRangeMin?: number;
  ageRangeMax?: number;
  intentions?: string[];
  connectWith?: string[];
  bio?: string;
  job_title?: string | null;
  company_name?: string | null;
  education_key?: string;
  zodiac_key?: string;
  smoking_key?: string;
  relationship_key?: string;
  height_cm?: number;
  is_invisible?: boolean;
  filter_only_verified?: boolean;
  university_id?: string | null;
  university_name_custom?: string | null;
  graduation_year?: number | null;
  show_university_on_home?: boolean;
  [key: string]: unknown;
};

export async function getProfile(): Promise<ProfilePayload | null> {
  logger.log("[getProfile] Invoking get-profile edge function");
  const { data, error } = await supabase.functions.invoke("get-profile");
  
  logger.log("[getProfile] Edge function response:", {
    hasData: !!data,
    hasError: !!error,
    errorMessage: error?.message,
  });

  if (error) {
    logger.error("[getProfile] Edge function error:", error);
    // Throw the original error to preserve HTTP status code
    throw error;
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

export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>
) {
  const { data, error } = await supabase.functions.invoke(
    "update-notification-settings",
    {
      body: settings,
    }
  );

  if (error) {
    throw new Error(
      error.message || "Não foi possível atualizar as configurações."
    );
  }

  return data as NotificationSettings;
}

/**
 * Create a verification session with Didit API.
 * Returns the verification URL to open in WebView.
 */
export async function createVerificationSession(): Promise<{
  verification_url: string;
  session_id: string;
  status: string;
}> {
  logger.log("[createVerificationSession] Invoking didit-session edge function");
  
  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    verification_url: string;
    session_id: string;
    status: string;
  }>("didit-session", {
    method: "POST",
  });

  logger.log("[createVerificationSession] Response:", {
    hasData: !!data,
    hasError: !!error,
    errorMessage: error?.message,
  });

  if (error) {
    logger.error("[createVerificationSession] Edge function error:", error);
    throw error;
  }

  if (!data?.verification_url) {
    throw new Error("No verification URL returned");
  }

  return {
    verification_url: data.verification_url,
    session_id: data.session_id,
    status: data.status,
  };
}
