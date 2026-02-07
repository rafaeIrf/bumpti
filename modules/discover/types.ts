
/**
 * A secondary encounter type that was deduplicated away by the priority system.
 * Included in the winning row so the UI can show consolidated context.
 */
export type AdditionalEncounter = {
  type: "direct_overlap" | "routine_match" | "vibe_match" | "path_match";
  place_name: string | null;
  affinity_score: number;
};

/**
 * A single encounter from the get_discover_feed RPC.
 * After global dedup, each other_user_id appears exactly once.
 * The `encounter_type` is the highest-priority type for this user.
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
  /** Secondary encounter types deduplicated away by priority hierarchy */
  additional_encounters: AdditionalEncounter[] | null;
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
