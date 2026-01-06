import { fetchAndSetUserProfile } from "@/modules/profile/index";
import { useAppSelector } from "@/modules/store/hooks";
import { useCallback, useEffect, useState } from "react";

type UseProfileOptions = {
  enabled?: boolean;
  force?: boolean;
};

export function useProfile(options: UseProfileOptions = {}) {
  const { enabled = true, force = false } = options;
  const profileState = useAppSelector((state) => state.profile);

  const [error, setError] = useState<string | undefined>();
  const [hasFetched, setHasFetched] = useState(false);
  const fetchProfile = useCallback(async () => {
    try {
      setError(undefined);
      await fetchAndSetUserProfile();
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar seu perfil.");
    }
  }, []);

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
