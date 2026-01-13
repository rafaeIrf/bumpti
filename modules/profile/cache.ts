import { getDatabase } from "@/modules/database";
import Profile from "@/modules/database/models/Profile";
import { supabase } from "@/modules/supabase/client";
import { prefetchImages } from "@/utils/image-prefetch";
import { logger } from "@/utils/logger";
import { Q } from "@nozbe/watermelondb";

/**
 * Service Layer para Profile Preview com arquitetura Local-First
 * Implementa padrão Stale-While-Revalidate:
 * 
 * 1. Retorna dados do cache imediatamente (mesmo se antigos)
 * 2. Dispara atualização em background se cache estiver stale (> 24h)
 * 3. Atualiza o cache quando a API responder
 */

export interface CachedProfileData {
  user_id: string;
  name: string;
  age: number | null;
  bio: string | null;
  intentions: string[];
  photos: string[];
  job_title: string | null;
  company_name: string | null;
  height_cm: number | null;
  location: string | null;
  languages: string[];
  education_level: string | null;
  zodiac_sign: string | null;
  relationship_status: string | null;
  smoking_habit: string | null;
  favorite_places: Array<{ id: string; name: string; category: string }>;
  visited_places_count: number;
}

/**
 * Busca perfil de outro usuário via Edge Function get-public-profile
 * Esta é uma função helper que chama a Edge Function apropriada
 */
async function fetchProfileFromAPI(userId: string): Promise<CachedProfileData | null> {
  try {
    logger.log(`[fetchProfileFromAPI] Calling Edge Function for user ${userId}`);
    
    // Chama a Edge Function existente para buscar perfil público
    const { data, error } = await supabase.functions.invoke("get-public-profile", {
      body: { userId },
    });

    if (error) {
      logger.error(`[fetchProfileFromAPI] Edge Function error for user ${userId}:`, error);
      return null;
    }

    logger.log(`[fetchProfileFromAPI] Edge Function response for user ${userId}:`, data ? 'SUCCESS' : 'NULL');

    // A resposta deve estar no formato esperado pela nossa interface
    const profile = data?.profile;
    if (!profile) {
      logger.warn(`[fetchProfileFromAPI] No profile in response for user ${userId}`);
      return null;
    }

    return {
      user_id: profile.user_id,
      name: profile.name,
      age: profile.age,
      bio: profile.bio,
      intentions: profile.intentions || [],
      photos: profile.photos || [],
      job_title: profile.job_title,
      company_name: profile.company_name,
      height_cm: profile.height_cm,
      location: profile.location,
      languages: profile.languages || [],
      education_level: profile.education_level,
      zodiac_sign: profile.zodiac_sign,
      relationship_status: profile.relationship_status,
      smoking_habit: profile.smoking_habit,
      favorite_places: profile.favorite_places || [],
      visited_places_count: profile.visited_places_count || 0,
    };
  } catch (error) {
    logger.error("Failed to fetch profile from API:", error);
    return null;
  }
}

/**
 * Atualiza ou cria um perfil no cache local
 */
async function upsertProfileCache(userId: string, profileData: CachedProfileData): Promise<Profile> {
  logger.log(`[upsertProfileCache] Starting upsert for user ${userId}`);
  
  const database = await getDatabase();
  const profilesCollection = database.collections.get<Profile>("profiles");

  // Buscar perfil existente
  const existingProfiles = await profilesCollection
    .query(Q.where("user_id", userId))
    .fetch();

  const existingProfile = existingProfiles[0];

  // Prefetch images immediately after upserting
  if (profileData.photos && profileData.photos.length > 0) {
    logger.log(`[upsertProfileCache] Prefetching ${profileData.photos.length} photos for user ${userId}`);
    prefetchImages(profileData.photos).catch((err) => {
      logger.warn(`[upsertProfileCache] Failed to prefetch images for user ${userId}:`, err);
    });
  }

  if (existingProfile) {
    // Atualizar perfil existente
    logger.log(`[upsertProfileCache] Updating existing profile for user ${userId}`);
    await database.write(async () => {
      await existingProfile.updateData(profileData);
    });
    logger.log(`[upsertProfileCache] Profile updated successfully for user ${userId}`);
    return existingProfile;
  } else {
    // Criar novo perfil
    logger.log(`[upsertProfileCache] Creating new profile for user ${userId}`);
    let newProfile: Profile;
    await database.write(async () => {
      newProfile = await profilesCollection.create((profile: any) => {
        profile.userId = userId;
        profile.rawData = JSON.stringify(profileData);
        profile.lastFetchedAt = new Date();
        // createdAt é @readonly e gerenciado automaticamente pelo WatermelonDB
      });
    });
    logger.log(`[upsertProfileCache] New profile created successfully for user ${userId}`);
    return newProfile!;
  }
}

/**
 * Busca perfil do cache local
 */
async function getProfileFromCache(userId: string): Promise<Profile | null> {
  const database = await getDatabase();
  const profilesCollection = database.collections.get<Profile>("profiles");

  const profiles = await profilesCollection
    .query(Q.where("user_id", userId))
    .fetch();

  return profiles[0] || null;
}

/**
 * Carrega perfil com SWR agressivo
 * 
 * SEMPRE dispara fetch em background se throttle (5min) permitir.
 * Retorna dados do cache imediatamente para UI instantânea.
 * 
 * @param userId - ID do usuário
 * @returns Profile do cache (ou null se não existir)
 */
/**
 * Carrega perfil com SWR agressivo
 * 
 * SEMPRE dispara fetch em background (sem throttle).
 * Use apenas no Chat para pre-carregar dados.
 * 
 * @param userId - ID do usuário
 * @param force - Se true, força fetch mesmo se recente
 * @returns Profile do cache (ou null se não existir)
 */
export async function loadProfile(userId: string, force: boolean = true): Promise<Profile | null> {
  try {
    logger.log(`[loadProfile] Starting for user ${userId} (force: ${force})`);
    
    // 1. Buscar do cache primeiro
    const cachedProfile = await getProfileFromCache(userId);
    logger.log(`[loadProfile] Cache result for user ${userId}:`, cachedProfile ? 'FOUND' : 'NOT FOUND');

    // 2. Verificar se deve fazer fetch
    const shouldFetch = force || !cachedProfile || cachedProfile.shouldFetch;
    
    if (shouldFetch) {
      const reason = !cachedProfile 
        ? "No cache found" 
        : force 
          ? "Force fetch"
          : "Throttle expired (>5min)";
      
      logger.log(`[loadProfile] ${reason} for user ${userId}, fetching in background`);
      
      // Fetch em background (não bloqueia retorno)
      fetchProfileFromAPI(userId)
        .then((freshData) => {
          if (freshData) {
            logger.log(`[loadProfile] API returned data for user ${userId}, upserting to cache`);
            return upsertProfileCache(userId, freshData);
          } else {
            logger.warn(`[loadProfile] API returned null for user ${userId}`);
          }
        })
        .catch((error) => {
          logger.error(`[loadProfile] Background profile fetch failed for user ${userId}:`, error);
        });
    } else {
      const secondsAgo = Math.round((Date.now() - cachedProfile!.lastFetchedAt.getTime()) / 1000);
      logger.log(`[loadProfile] Profile throttled for user ${userId} (fetched ${secondsAgo}s ago)`);
    }

    // 3. Retornar cache imediatamente (ou null se não existir)
    logger.log(`[loadProfile] Returning cache for user ${userId}:`, cachedProfile ? 'YES' : 'NULL');
    return cachedProfile;

  } catch (error) {
    logger.error("[loadProfile] Error in loadProfile:", error);
    return null;
  }
}

/**
 * DEPRECATED: Use loadProfile() para novo padrão SWR agressivo
 * 
 * Mantido para compatibilidade com código existente.
 * Esta função ainda faz fetch síncrono quando não há cache.
 */
export async function getOrFetchProfile(userId: string): Promise<Profile | null> {
  try {
    // 1. Tentar buscar do cache primeiro
    const cachedProfile = await getProfileFromCache(userId);

    if (cachedProfile) {
      logger.log(`Profile found in cache for user ${userId}`);

      // 2. Disparar atualização em background se throttle permitir
      if (cachedProfile.shouldFetch) {
        logger.log(`Cache throttle expired for user ${userId}, refreshing in background`);
        
        // Atualização em background (não bloqueia a UI)
        fetchProfileFromAPI(userId)
          .then((freshData) => {
            if (freshData) {
              return upsertProfileCache(userId, freshData);
            }
          })
          .catch((error) => {
            logger.error("Background profile refresh failed:", error);
          });
      }

      // 3. Retornar dados do cache imediatamente
      return cachedProfile;
    }

    // 4. Se não houver cache, buscar de forma síncrona
    logger.log(`No cache found for user ${userId}, fetching from API`);
    const freshData = await fetchProfileFromAPI(userId);

    if (!freshData) {
      logger.warn(`Failed to fetch profile for user ${userId}`);
      return null;
    }

    // 5. Salvar no cache e retornar
    const newProfile = await upsertProfileCache(userId, freshData);
    return newProfile;

  } catch (error) {
    logger.error("Error in getOrFetchProfile:", error);
    return null;
  }
}

/**
 * Força a atualização de um perfil (útil para pull-to-refresh)
 * Ignora throttle e sempre busca dados frescos
 */
export async function forceRefreshProfile(userId: string): Promise<Profile | null> {
  try {
    logger.log(`Force refreshing profile for user ${userId}`);
    const freshData = await fetchProfileFromAPI(userId);

    if (!freshData) {
      logger.warn(`Failed to force refresh profile for user ${userId}`);
      return null;
    }

    const updatedProfile = await upsertProfileCache(userId, freshData);
    return updatedProfile;
  } catch (error) {
    logger.error("Error in forceRefreshProfile:", error);
    return null;
  }
}

/**
 * Pre-carrega perfil em background (para usar no Chat)
 * SEMPRE força fetch para garantir dados frescos
 */
export async function preloadProfile(userId: string): Promise<void> {
  try {
    logger.log(`[preloadProfile] Pre-loading profile for user ${userId}`);
    // Força fetch sempre (force = true)
    await loadProfile(userId, true);
  } catch (error) {
    logger.error("[preloadProfile] Error in preloadProfile:", error);
  }
}

/**
 * Limpa o cache de um perfil específico
 */
export async function clearProfileCache(userId: string): Promise<void> {
  try {
    const database = await getDatabase();
    const profilesCollection = database.collections.get<Profile>("profiles");

    const profiles = await profilesCollection
      .query(Q.where("user_id", userId))
      .fetch();

    if (profiles.length > 0) {
      await database.write(async () => {
        await profiles[0].markAsDeleted();
      });
      logger.log(`Cleared profile cache for user ${userId}`);
    }
  } catch (error) {
    logger.error("Error clearing profile cache:", error);
  }
}
