import { useEffect, useState, useCallback } from "react";
import { getProfile } from "@/modules/profile/api";
import { profileActions } from "@/modules/store/slices/profileActions";
import { useAppSelector, useAppDispatch } from "@/modules/store/hooks";

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
      profileActions.setProfile({
        id: data?.id,
        name: data?.name ?? null,
        birthdate: data?.birthdate ?? null,
        gender: data?.gender ?? null,
        gender_id: data?.gender_id ?? null,
        age_range_min: data?.age_range_min ?? null,
        age_range_max: data?.age_range_max ?? null,
        connectWith: data?.connectWith ?? [],
        intentions: data?.intentions ?? [],
        photos: data?.photos ?? [],
        updatedAt: data?.updated_at ?? null,
        bio: data?.bio ?? null,
      });
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
