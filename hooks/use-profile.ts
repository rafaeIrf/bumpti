import { useEffect, useState, useCallback } from "react";
import { getProfile } from "@/modules/supabase/onboarding-service";
import { profileActions } from "@/modules/store/slices/profileActions";
import { useAppSelector } from "@/modules/store/hooks";

type UseProfileOptions = {
  enabled?: boolean;
  force?: boolean;
};

export function useProfile(options: UseProfileOptions = {}) {
  const { enabled = true, force = false } = options;
  const profileState = useAppSelector((state) => state.profile);
  const [error, setError] = useState<string | undefined>();

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
        connectWith: data?.connectWith ?? [],
        intentions: data?.intentions ?? [],
        photos: data?.photos ?? [],
        updatedAt: data?.updated_at ?? null,
      });
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar seu perfil.");
    } finally {
      profileActions.setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (profileState.data && !force) return;
    fetchProfile();
  }, [enabled, force, fetchProfile, profileState.data]);

  return {
    profile: profileState.data,
    isLoading: profileState.isLoading,
    error,
    refetch: fetchProfile,
  };
}
