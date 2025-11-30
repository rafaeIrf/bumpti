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
  entered_at: string;
  expires_at: string;
  visitedPlacesCount: number;
  favoritePlaces: string[];
};

export type ActiveUsersResponse = {
  place_id: string;
  count: number;
  users: ActiveUserAtPlace[];
};

export async function enterPlace(params: {
  placeId: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<PresenceRecord | null> {
  try {
    const { placeId, lat, lng } = params;

    const { data, error } = await supabase.functions.invoke<{
      presence: PresenceRecord;
    }>("enter-place", {
      body: {
        place_id: placeId,
        ...(typeof lat === "number" ? { lat } : {}),
        ...(typeof lng === "number" ? { lng } : {}),
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
    console.log("getActiveUsersAtPlace data:", data?.users[0]);

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
