import { getProfile } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { profileActions } from "@/modules/store/slices/profileActions";
import { calculateAge } from "@/utils/calculate-age";
import { useCallback, useEffect, useState } from "react";

type UseProfileOptions = {
  enabled?: boolean;
  force?: boolean;
};

export function useProfile(options: UseProfileOptions = {}) {
  const { enabled = true, force = false } = options;
  const profileState = useAppSelector((state) => state.profile);
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | undefined>();
  const [hasFetched, setHasFetched] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      profileActions.setProfileLoading(true);
      setError(undefined);
      const data = await getProfile();
      if (!data) {
        profileActions.setProfile(null);
      } else {
        profileActions.setProfile({
          id: data?.id,
          name: data?.name ?? null,
          birthdate: data?.birthdate ?? null,
          gender: data?.gender ?? null,
          gender_id: data?.gender_id ?? null,
          age_range_min: data?.age_range_min ?? null,
          age_range_max: data?.age_range_max ?? null,
          age: calculateAge(data?.birthdate ?? null),
          connectWith: data?.connectWith ?? [],
          intentions: data?.intentions ?? [],
          photos: data?.photos ?? [],
          updatedAt: data?.updated_at ?? null,
          bio: data?.bio ?? null,
          favoritePlaces: data?.favoritePlaces ?? [],
          height_cm: data?.height_cm ?? null,
          job_title: data?.job_title ?? null,
          company_name: data?.company_name ?? null,
          smoking_key: data?.smoking_key ?? null,
          education_key: data?.education_key ?? null,
          location: data?.location ?? null,
          languages: data?.languages ?? [],
          zodiac_key: data?.zodiac_key ?? null,
          relationship_key: data?.relationship_key ?? null,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar seu perfil.");
    } finally {
      profileActions.setProfileLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!enabled) return;
    if (hasFetched) return;
    if (profileState.data && !force) return;
    setHasFetched(true);
    fetchProfile();
  }, [enabled, force, fetchProfile, hasFetched, profileState.data]);

  return {
    profile: profileState.data,
    isLoading: profileState.isLoading,
    error,
    refetch: fetchProfile,
  };
}
