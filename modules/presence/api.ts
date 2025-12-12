import { supabase } from "@/modules/supabase/client";

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
};

export type ActiveUsersResponse = {
  place_id: string;
  count: number;
  users: ActiveUserAtPlace[];
};

export async function enterPlace(params: {
  placeId: string;
  userLat: number;
  userLng: number;
  placeLat: number;
  placeLng: number;
}): Promise<PresenceRecord | null> {
  try {
    const { placeId, userLat, userLng, placeLat, placeLng } = params;

    console.log("enterPlace params:", params)

    const { data, error } = await supabase.functions.invoke<{
      presence: PresenceRecord;
    }>("enter-place", {
      body: {
        place_id: placeId,
        userLat,
        userLng,
        place_lat: placeLat,
        place_lng: placeLng,
      },
    });

    if (error) {
      console.error("enterPlace (edge) error:", error);
      return null;
    }

    return data?.presence ?? null;
  } catch (err) {
    console.error("enterPlace (api) error:", err);
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
      console.error("refreshPresence (edge) error:", error);
      return null;
    }

    return data?.presence ?? null;
  } catch (err) {
    console.error("refreshPresence (api) error:", err);
    return null;
  }
}

export async function getActiveUsersAtPlace(
  placeId: string
): Promise<ActiveUsersResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke<ActiveUsersResponse>(
      "get-active-users-at-place",
      {
        body: { place_id: placeId },
      }
    );
    console.log("getActiveUsersAtPlace data:", data);

    if (error) {
      console.error("get-active-users-at-place (edge) error:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error("getActiveUsersAtPlace (api) error:", err);
    return null;
  }
}
