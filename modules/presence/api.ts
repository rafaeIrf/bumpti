import { store } from "@/modules/store";
import { setCheckinCredits } from "@/modules/store/slices/profileSlice";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { trackCheckin } from "../analytics";
import {
    getMockActiveUsersForReviewer,
    getMockPresenceForReviewer,
    REVIEWER_EMAILS
} from "./reviewer-mock-data";

/**
 * Check if the current authenticated user is an Apple reviewer.
 * Caches the result to avoid repeated auth calls.
 */
let _isReviewerCached: boolean | null = null;
async function isReviewerAccount(): Promise<boolean> {
  if (_isReviewerCached !== null) return _isReviewerCached;
  try {
    const { data } = await supabase.auth.getUser();
    _isReviewerCached = REVIEWER_EMAILS.includes(
      data?.user?.email?.toLowerCase() || ""
    );
    return _isReviewerCached;
  } catch {
    return false;
  }
}

export type PresenceRecord = {
  id: string;
  user_id: string;
  place_id: string;
  entered_at: string;
  expires_at: string;
  ended_at: string | null;
  active: boolean;
  lat: number | null;
  lng: number | null;
};


export type ActiveUserAtPlace = {
  user_id: string;
  name: string | null;
  age: number | null;
  bio: string | null;
  intentions: string[];
  interests: string[];
  photos: string[];
  entered_at?: string;
  expires_at?: string;
  visited_places_count?: number;
  favorite_places: (string | { id: string; name?: string; emoji?: string })[];
  job_title?: string | null;
  company_name?: string | null;
  height_cm?: number | null;
  location?: string | null;
  languages?: string[];
  relationship_status?: string | null;
  smoking_habit?: string | null;
  education_level?: string | null;
  place_id?: string | null;
  zodiac_sign: string | null;
  verification_status?: "unverified" | "pending" | "verified" | "rejected" | null;
  entry_type?: "physical" | "checkin_plus" | "planning" | "past_visitor" | "favorite"; // How user entered the place
  planned_for?: string | null; // ISO date string for planning entries
  planned_period?: "morning" | "afternoon" | "night" | null;
  // University fields
  university_id?: string | null;
  university_name?: string | null;
  university_name_custom?: string | null;
  university_lat?: number | null;
  university_lng?: number | null;
  graduation_year?: number | null;
  show_university_on_home?: boolean;
};

export type ActiveUsersResponse = {
  place_id: string;
  count: number;
  users: ActiveUserAtPlace[];
  regulars?: ActiveUserAtPlace[];
  regulars_count?: number;
  liker_ids?: string[];
};

export async function enterPlace(params: {
  placeId: string;
  userLat: number;
  userLng: number;
  placeLat: number;
  placeLng: number;
  isCheckinPlus?: boolean;
}): Promise<PresenceRecord | null> {
  try {
    const { placeId, userLat, userLng, placeLat, placeLng, isCheckinPlus } = params;

    // Bypass for Apple reviewer: skip edge function, return mock presence
    if (await isReviewerAccount()) {
      logger.debug("[Reviewer Bypass] enterPlace - returning mock presence");
      return getMockPresenceForReviewer(placeId);
    }

    logger.debug("enterPlace params", { params });

    const { data, error } = await supabase.functions.invoke<{
      presence: PresenceRecord;
      remaining_credits?: number;
    }>("enter-place", {
      body: {
        place_id: placeId,
        userLat,
        userLng,
        place_lat: placeLat,
        place_lng: placeLng,
        is_checkin_plus: isCheckinPlus,
      },
    });

    if (error) {
      logger.error("enterPlace (edge) error", { error });
      return null;
    }

    // Update Redux state with remaining credits if returned (indicates check-in+ was used)
    if (typeof data?.remaining_credits === "number") {
      store.dispatch(setCheckinCredits(data.remaining_credits));
    }

    // Track analytics conversion event
    if (data?.presence) {
      trackCheckin({
        placeId: params.placeId,
        entryType: params.isCheckinPlus ? "checkin_plus" : "physical",
      });
    }

    return data?.presence ?? null;
  } catch (err) {
    logger.error("enterPlace (api) error", { err });
    return null;
  }
}

export async function refreshPresence(placeId: string): Promise<PresenceRecord | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      presence: PresenceRecord;
    }>("refresh-presence", {
      body: { place_id: placeId },
    });

    if (error) {
      logger.error("refreshPresence (edge) error", { error });
      return null;
    }

    return data?.presence ?? null;
  } catch (err) {
    logger.error("refreshPresence (api) error", { err });
    return null;
  }
}

export async function getActiveUsersAtPlace(
  placeId: string
): Promise<ActiveUsersResponse | null> {
  try {
    // Bypass for Apple reviewer: return mock active users
    if (await isReviewerAccount()) {
      logger.debug("[Reviewer Bypass] getActiveUsersAtPlace - returning mock users");
      return getMockActiveUsersForReviewer(placeId);
    }

    const { data, error } = await supabase.functions.invoke<ActiveUsersResponse>(
      "get-active-users-at-place",
      {
        body: { place_id: placeId },
      }
    );
    logger.debug("getActiveUsersAtPlace data", { data });

    if (error) {
      logger.error("get-active-users-at-place (edge) error", { error });
      return null;
    }

    if (!data) {
      return null;
    }

    return data;
  } catch (err) {
    logger.error("getActiveUsersAtPlace (api) error", { err });
    return null;
  }
}
