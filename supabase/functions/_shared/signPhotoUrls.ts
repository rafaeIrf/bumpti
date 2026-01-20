import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const SIGNED_URL_EXPIRES = 60 * 60 * 24; // 24 hours

// Type for avatar with user_id
type UserAvatar = { user_id: string; url: string };

/**
 * Signs photo URLs from profile_photos.url paths
 * Returns signed URLs with 24h expiration
 */
export async function signPhotoUrls(
  supabase: SupabaseClient,
  urls: string[] | null | undefined
): Promise<string[]> {
  if (!urls || urls.length === 0) {
    return [];
  }

  const signedUrls = await Promise.all(
    urls.map(async (url) => {
      if (!url) return null;

      const { data, error } = await supabase.storage
        .from("user_photos")
        .createSignedUrl(url, SIGNED_URL_EXPIRES);

      if (error || !data?.signedUrl) {
        console.error("signPhotoUrls error", { url, error });
        return null;
      }

      return data.signedUrl;
    })
  );

  return signedUrls.filter((url): url is string => url !== null);
}

/**
 * Signs photo URLs in UserAvatar array, preserving user_id
 * Returns array of UserAvatar with signed URLs
 */
export async function signUserAvatars(
  supabase: SupabaseClient,
  avatars: UserAvatar[] | null | undefined
): Promise<UserAvatar[]> {
  if (!avatars || avatars.length === 0) {
    return [];
  }

  const signedAvatars = await Promise.all(
    avatars.map(async (avatar) => {
      if (!avatar?.url) return null;

      const { data, error } = await supabase.storage
        .from("user_photos")
        .createSignedUrl(avatar.url, SIGNED_URL_EXPIRES);

      if (error || !data?.signedUrl) {
        console.error("signUserAvatars error", { url: avatar.url, error });
        return null;
      }

      return { user_id: avatar.user_id, url: data.signedUrl };
    })
  );

  return signedAvatars.filter((a): a is UserAvatar => a !== null);
}

