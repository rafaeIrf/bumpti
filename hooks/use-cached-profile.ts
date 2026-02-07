import { getDatabase } from "@/modules/database";
import Profile from "@/modules/database/models/Profile";
import { forceRefreshProfile, loadProfile } from "@/modules/profile/cache";
import { logger } from "@/utils/logger";
import { Q } from "@nozbe/watermelondb";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para OBSERVAR perfil cacheado localmente (REACTIVE)
 * 
 * Auto-fetches via loadProfile() se não encontrar cache local.
 * Observa mudanças no WatermelonDB para updates em tempo real.
 * 
 * Fluxo:
 * 1. Verifica cache local no WatermelonDB
 * 2. Se não existir → chama loadProfile() para buscar via Edge Function
 * 3. Dados salvos no WatermelonDB → observer atualiza UI automaticamente
 * 
 * @param userId - ID do usuário cujo perfil será observado
 * @param options - Opções do hook
 * @returns Profile data, loading state, e função de refresh
 */
export function useCachedProfile(
  userId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTriggered = useRef(false);

  // Função para buscar perfil inicial do cache, e disparar fetch se necessário
  const loadInitialCache = useCallback(async () => {
    if (!userId || !enabled) {
      setIsLoading(false);
      return;
    }

    try {
      logger.log(`[useCachedProfile] Loading initial cache for user ${userId}`);
      
      const database = await getDatabase();
      const profilesCollection = database.collections.get<Profile>("profiles");
      
      const profiles = await profilesCollection
        .query(Q.where("user_id", userId))
        .fetch();
      
      if (profiles.length > 0) {
        logger.log(`[useCachedProfile] Initial cache found for user ${userId}`);
        setProfile(profiles[0]);
        setIsLoading(false);
      } else {
        logger.log(`[useCachedProfile] No initial cache for user ${userId}, auto-fetching...`);
        setProfile(null);
        // Auto-fetch: dispara loadProfile para buscar e popular o cache
        if (!fetchTriggered.current) {
          fetchTriggered.current = true;
          loadProfile(userId, true)
            .then(() => {
              logger.log(`[useCachedProfile] Auto-fetch completed for user ${userId}`);
            })
            .catch((err) => {
              logger.error(`[useCachedProfile] Auto-fetch failed for user ${userId}:`, err);
              setError("Erro ao carregar perfil");
              setIsLoading(false);
            });
        }
      }
    } catch (err) {
      logger.error("[useCachedProfile] Error loading initial cache:", err);
      setError("Erro ao carregar perfil");
      setIsLoading(false);
    }
  }, [userId, enabled]);

  // Função para forçar refresh (pull-to-refresh)
  const refresh = useCallback(async () => {
    if (!userId) return;

    try {
      setIsRefreshing(true);
      setError(null);
      const updatedProfile = await forceRefreshProfile(userId);
      
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    } catch (err) {
      logger.error("Error refreshing profile:", err);
      setError("Erro ao atualizar perfil");
    } finally {
      setIsRefreshing(false);
    }
  }, [userId]);

  // Carregar cache inicial na montagem (sem fazer fetch)
  useEffect(() => {
    loadInitialCache();
  }, [loadInitialCache]);

  // Observar mudanças no perfil (reactive)
  // IMPORTANTE: Não depende de `profile` - deve observar mesmo sem cache inicial
  useEffect(() => {
    if (!userId || !enabled) return;

    let unsubscribe: (() => void) | undefined;

    const setupObserver = async () => {
      try {
        const database = await getDatabase();
        const profilesCollection = database.collections.get<Profile>("profiles");

        const query = profilesCollection
          .query(Q.where("user_id", userId))
          .observe();

        const subscription = query.subscribe((profiles) => {
          logger.log(`Profile observer triggered for user ${userId}, found ${profiles.length} profiles`);
          
          if (profiles.length > 0) {
            setProfile(profiles[0]);
            setIsLoading(false); // Garante que loading é desativado quando dados chegam
          } else {
            // Sem perfil no banco ainda (aguardando fetch em background)
            setProfile(null);
          }
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch (err) {
        logger.error("Error setting up profile observer:", err);
      }
    };

    setupObserver();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, enabled]);

  return {
    profile,
    profileData: profile?.data || null,
    isLoading,
    isRefreshing,
    error,
    refresh,
    isStale: profile?.isStale || false,
  };
}

