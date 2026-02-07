
/**
 * A single encounter from the get_discover_feed RPC.
 */
export type DiscoverEncounter = {
  user_a_id: string;
  user_b_id: string;
  place_id: string;
  encounter_type: "direct_overlap" | "routine_match" | "vibe_match" | "path_match";
  affinity_score: number;
  last_encountered_at: string;
  metadata: {
    overlap_seconds?: number;
    shared_interests?: number;
    shared_places?: number;
  };
  shared_interests_count: number;
  // other_user fields from the RPC
  other_user_id: string;
  other_name: string | null;
  other_age: number | null;
  other_photos: string[] | null;
  other_verification_status: string | null;
  other_bio: string | null;
  place_name: string | null;
};

/**
 * Categorized discover feed.
 */
export type DiscoverFeed = {
  direct_overlap: DiscoverEncounter[];
  vibe_match: DiscoverEncounter[];
  path_match: DiscoverEncounter[];
};

/**
 * Profile data hydrated from WatermelonDB or fetched from API.
 */
export type HydratedProfile = {
  user_id: string;
  name: string | null;
  age: number | null;
  photos: string[];
  bio: string | null;
  verification_status: string | null;
  interests: string[];
  isLoading: boolean;
};
