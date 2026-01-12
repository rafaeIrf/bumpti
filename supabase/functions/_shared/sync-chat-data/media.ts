const SIGNED_URL_EXPIRES_SECONDS = 60 * 60 * 24;

export async function fetchPhotosInBatch(
  supabaseAdmin: any,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const uniqueUserIds = [...new Set(userIds)];

  const { data, error } = await supabaseAdmin
    .from("profile_photos")
    .select("user_id, url")
    .in("user_id", uniqueUserIds)
    .eq("position", 0);

  if (error) {
    console.error("[Photos] Batch fetch error:", error);
    return new Map();
  }

  return new Map((data || []).map((p: any) => [p.user_id, p.url]));
}

export async function signPhotoUrl(
  supabaseAdmin: any,
  photoPath: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("user_photos")
      .createSignedUrl(photoPath, SIGNED_URL_EXPIRES_SECONDS);

    if (error || !data?.signedUrl) {
      console.error("[Sign] Error for", photoPath, ":", error);
      return null;
    }

    return data.signedUrl;
  } catch (e) {
    console.error("[Sign] Exception for", photoPath, ":", e);
    return null;
  }
}

export async function signPhotoUrlsInBatch(
  supabaseAdmin: any,
  photoPaths: string[]
): Promise<Map<string, string | null>> {
  const uniquePaths = [...new Set(photoPaths.filter(Boolean))];
  if (uniquePaths.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabaseAdmin.storage
      .from("user_photos")
      .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRES_SECONDS);

    if (error || !data) {
      console.error("[SignBatch] Error:", error);
      return new Map();
    }

    const signedMap = new Map<string, string | null>();
    data.forEach((item: any) => {
      signedMap.set(item.path, item.signedUrl ?? null);
    });

    return signedMap;
  } catch (e) {
    console.error("[SignBatch] Exception:", e);
    return new Map();
  }
}

export function mergeUpdated(existing: any[], extra: any[]): any[] {
  const map = new Map<string, any>();
  existing.forEach((item) => map.set(item.id, item));
  extra.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}
