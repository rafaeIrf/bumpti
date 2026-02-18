import { useDatabase } from "@/components/DatabaseProvider";
import { useProfile } from "@/hooks/use-profile";
import type Chat from "@/modules/database/models/Chat";
import type DiscoveryProfile from "@/modules/database/models/DiscoveryProfile";
import type Match from "@/modules/database/models/Match";
import type SwipeQueue from "@/modules/database/models/SwipeQueue";
import { fetchDiscoveryFeed } from "@/modules/discovery/discovery-service";
import { filterDiscoveryProfiles } from "@/modules/discovery/utils";
import type { ActiveUserAtPlace } from "@/modules/presence/api";
import { Q } from "@nozbe/watermelondb";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useDiscoveryFeed(
  placeId?: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const database = useDatabase();
  const { profile } = useProfile();
  const [discoveryRecords, setDiscoveryRecords] = useState<DiscoveryProfile[]>(
    []
  );
  const [swipeRecords, setSwipeRecords] = useState<SwipeQueue[]>([]);
  const [matchRecords, setMatchRecords] = useState<Match[]>([]);
  const [chatRecords, setChatRecords] = useState<Chat[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    const collection = database.collections.get<DiscoveryProfile>(
      "discovery_profiles"
    );
    const swipedIds = swipeRecords
      .filter((record) => record.placeId === placeId)
      .map((record) => record.targetUserId);
    const matchedIds = matchRecords
      .map((match) => {
        if (match.otherUserId) return match.otherUserId;
        if (!profile?.id) return null;
        return match.userA === profile.id ? match.userB : match.userA;
      })
      .filter((id): id is string => Boolean(id));
    const chattedIds = chatRecords
      .map((chat) => chat.otherUserId)
      .filter((id): id is string => Boolean(id));
    const excludedIds = Array.from(
      new Set([...swipedIds, ...matchedIds, ...chattedIds])
    );
    const queryFilters = [Q.where("place_id", placeId)];
    if (excludedIds.length > 0) {
      queryFilters.push(Q.where("id", Q.notIn(excludedIds)));
    }
    const subscription = collection
      .query(...queryFilters)
      .observeWithColumns(["raw_data", "place_id", "last_fetched_at"])
      .subscribe(setDiscoveryRecords);

    return () => subscription.unsubscribe();
  }, [chatRecords, database, matchRecords, placeId, profile?.id, swipeRecords]);

  useEffect(() => {
    const collection = database.collections.get<SwipeQueue>("swipes_queue");
    const subscription = collection
      .query()
      .observeWithColumns(["target_user_id", "action", "place_id"])
      .subscribe(setSwipeRecords);

    return () => subscription.unsubscribe();
  }, [database]);

  useEffect(() => {
    const collection = database.collections.get<Match>("matches");
    const subscription = collection
      .query()
      .observeWithColumns(["other_user_id", "user_a", "user_b", "status"])
      .subscribe(setMatchRecords);

    return () => subscription.unsubscribe();
  }, [database]);

  useEffect(() => {
    const collection = database.collections.get<Chat>("chats");
    const subscription = collection
      .query()
      .observeWithColumns(["other_user_id"])
      .subscribe(setChatRecords);

    return () => subscription.unsubscribe();
  }, [database]);

  const refresh = useCallback(async () => {
    if (!placeId || !enabled) return;
    setIsFetching(true);
    try {
      await fetchDiscoveryFeed({ database, placeId });
    } finally {
      setIsFetching(false);
    }
  }, [database, enabled, placeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const profiles = useMemo(() => {
    const swipedIds = swipeRecords
      .filter((record) => record.placeId === placeId)
      .map((swipe) => swipe.targetUserId);
    const matchedIds = matchRecords
      .map((match) => {
        if (match.otherUserId) return match.otherUserId;
        if (!profile?.id) return null;
        return match.userA === profile.id ? match.userB : match.userA;
      })
      .filter((id): id is string => Boolean(id));
    const chattedIds = chatRecords
      .map((chat) => chat.otherUserId)
      .filter((id): id is string => Boolean(id));

    const rawProfiles = discoveryRecords
      .map((record) => record.data as ActiveUserAtPlace | null)
      .filter((record): record is ActiveUserAtPlace => Boolean(record));

    return filterDiscoveryProfiles({
      profiles: rawProfiles,
      swipedIds,
      matchedIds,
      chattedIds,
    });
  }, [chatRecords, discoveryRecords, matchRecords, profile?.id, swipeRecords]);

  const isLoading = isFetching && profiles.length === 0;

  return {
    profiles,
    isLoading,
    refresh,
  } as const;
}
