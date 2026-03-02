
import type { PresenceEntryType } from "@/utils/presence-badge";

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
  encounter_type: "direct_overlap" | "routine_match" | "vibe_match" | "path_match" | "shared_favorites";
  affinity_score: number;
  last_encountered_at: string;
  metadata: {
    overlap_seconds?: number;
    shared_interests?: number;
    shared_places?: number;
    shared_place_names?: string[];
    shared_interest_keys?: string[];
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
  /**
   * Raw presence entry_type of the other user at the time of exposure.
   * Set for shared_favorites ("favorite") so interact-user can populate
   * match_origin_override and the DB trigger can compute the correct match_origin.
   */
  entry_type?: PresenceEntryType | null;
};


/**
 * A user who shares favorite places with the viewer.
 * Returned by the get_shared_favorite_users RPC.
 */
export type SharedFavoriteUser = {
  other_user_id: string;
  other_name: string | null;
  other_age: number | null;
  other_photos: string[];
  other_verification_status: string | null;
  other_bio: string | null;
  shared_count: number;
  shared_place_ids: string[];
  shared_place_names: string[];
  shared_interest_keys: string[];
};

/**
 * Categorized discover feed.
 */
export type DiscoverFeed = {
  direct_overlap: DiscoverEncounter[];
  vibe_match: DiscoverEncounter[];
  path_match: DiscoverEncounter[];
  shared_favorites: SharedFavoriteUser[];
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
