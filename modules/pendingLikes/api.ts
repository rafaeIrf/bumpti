import { ActiveUserAtPlace } from "@/modules/presence/api";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";



export interface PendingLikesResponse {
  count: number;
  users: ActiveUserAtPlace[];
  photos: string[];
}

export async function fetchPendingLikes(): Promise<PendingLikesResponse> {
  const { data, error } = await supabase.functions.invoke<{
    count: number;
    users: ActiveUserAtPlace[];
  }>("get-pending-likes", {
    // no body required; auth handled by supabase client
  });

  if (error) {
    logger.error("get-pending-likes edge error:", error);
    return { count: 0, users: [], photos: [] };
  }

  const users = data?.users ?? [];
  // Extract first photo from each user for the preview/compatibility if needed
  const previewPhotos = users
    .map((u) => u.photos?.[0])
    .filter((p): p is string => !!p);

  return {
    count: data?.count ?? 0,
    users: users,
    photos: previewPhotos,
  };
}
