import type { ActiveUserAtPlace } from "@/modules/presence/api";

export function filterDiscoveryProfiles(params: {
  profiles: ActiveUserAtPlace[];
  swipedIds: string[];
  matchedIds: string[];
  chattedIds: string[];
}) {
  const { profiles, swipedIds, matchedIds, chattedIds } = params;
  const excludedIds = new Set([
    ...swipedIds,
    ...matchedIds,
    ...chattedIds,
  ]);

  return profiles.filter((profile) => {
    const id = profile?.user_id;
    return Boolean(id) && !excludedIds.has(id);
  });
}
