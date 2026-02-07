import { useDatabase } from "@/components/DatabaseProvider";
import type DiscoveryProfile from "@/modules/database/models/DiscoveryProfile";
import type { ActiveUserAtPlace } from "@/modules/presence/api";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export type HydratedProfileData = {
  user_id: string;
  name: string | null;
  age: number | null;
  photos: string[];
  bio: string | null;
  verification_status: string | null;
  interests: string[];
};

/**
 * Hook that observes a user's profile from WatermelonDB (discovery_profiles table).
 * If the profile isn't cached locally, it shows a skeleton and fetches in background.
 *
 * Uses the existing `DiscoveryProfile` model which stores `rawData` as JSON.
 */
export function useHydratedProfile(userId: string | undefined): {
  profile: HydratedProfileData | null;
  isLoading: boolean;
} {
  const database = useDatabase();
  const [profile, setProfile] = useState<HydratedProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const collection =
      database.collections.get<DiscoveryProfile>("discovery_profiles");

    // Try to observe from WatermelonDB first
    const subscription = collection
      .query(Q.where("id", userId))
      .observe()
      .subscribe((records) => {
        if (records.length > 0) {
          const data = records[0].data as ActiveUserAtPlace | null;
          if (data) {
            setProfile({
              user_id: data.user_id,
              name: data.name,
              age: data.age,
              photos: data.photos ?? [],
              bio: data.bio,
              verification_status: data.verification_status ?? null,
              interests: data.interests ?? [],
            });
            setIsLoading(false);
            return;
          }
        }

        // Not in local DB — fetch from Supabase silently
        fetchAndCacheProfile(userId);
      });

    return () => subscription.unsubscribe();
  }, [userId, database]);

  const fetchAndCacheProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-public-profile",
        {
          body: { userId: uid },
        }
      );

      if (error || !data) {
        logger.warn("[useHydratedProfile] Could not fetch profile:", uid);
        setIsLoading(false);
        return;
      }

      // get-public-profile returns { profile: {...} }
      const profileData = data?.profile;
      if (profileData) {
        const collection =
          database.collections.get<DiscoveryProfile>("discovery_profiles");
        await database.write(async () => {
          try {
            const existing = await collection.find(uid);
            await existing.update((record) => {
              record.rawData = JSON.stringify(profileData);
              record.lastFetchedAt = new Date();
            });
          } catch {
            await collection.create((record) => {
              record._raw.id = uid;
              record.rawData = JSON.stringify(profileData);
              record.placeId = "";
              record.lastFetchedAt = new Date();
            });
          }
        });

        setProfile({
          user_id: profileData.user_id ?? uid,
          name: profileData.name,
          age: profileData.age,
          photos: profileData.photos ?? [],
          bio: profileData.bio,
          verification_status: profileData.verification_status ?? null,
          interests: profileData.interests ?? [],
        });
      }

      setIsLoading(false);
    } catch (err) {
      logger.error("[useHydratedProfile] Fetch error:", err);
      setIsLoading(false);
    }
  };

  return { profile, isLoading };
}
