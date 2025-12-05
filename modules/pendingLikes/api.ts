import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";

export interface PendingLikesResponse {
  count: number;
  photos: string[];
}

export async function fetchPendingLikes(): Promise<PendingLikesResponse> {
  const { data, error } = await supabase.functions.invoke<{
    count: number;
    photos: string[];
  }>("get-pending-likes", {
    // no body required; auth handled by supabase client
  });

  if (error) {
    logger.error("get-pending-likes edge error:", error);
    return { count: 0, photos: [] };
  }

  return {
    count: data?.count ?? 0,
    photos: data?.photos ?? [],
  };
}
