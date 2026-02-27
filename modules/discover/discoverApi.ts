import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { DiscoverFeed } from "./types";

type DiscoverFeedArgs = {
  lat?: number | null;
  lng?: number | null;
};

type DiscoverFeedResponse = {
  has_recent_presence: boolean;
  feed: DiscoverFeed;
};

export const discoverApi = createApi({
  reducerPath: "discoverApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["DiscoverFeed"],
  endpoints: (builder) => ({
    /**
     * Fetches the discover feed via get-discover-feed Edge Function.
     * Returns presence status + categorized encounters.
     */
    getDiscoverFeed: builder.query<DiscoverFeedResponse, DiscoverFeedArgs | void>({
      queryFn: async (args) => {

        try {
          const body: Record<string, unknown> = {};
          if (args?.lat != null && args?.lng != null) {
            body.lat = args.lat;
            body.lng = args.lng;
          }

          const { data, error } =
            await supabase.functions.invoke<DiscoverFeedResponse>(
              "get-discover-feed",
              { method: "POST", body: JSON.stringify(body) }
            );

          if (error) {
            logger.error("[discoverApi] get-discover-feed error:", error);
            return { error: { status: "CUSTOM_ERROR", error: error.message } };
          }

          if (!data) {
            return {
              data: {
                has_recent_presence: false,
                feed: { direct_overlap: [], vibe_match: [], path_match: [], shared_favorites: [] },
              },
            };
          }

          logger.log("[discoverApi] Feed loaded:", {
            hasPresence: data.has_recent_presence,
            overlap: data.feed.direct_overlap.length,
            vibe: data.feed.vibe_match.length,
            path: data.feed.path_match.length,
            shared: data.feed.shared_favorites?.length ?? 0,
          });

          return { data };
        } catch (err) {
          logger.error("[discoverApi] Unexpected error:", err);
          return { error: { status: "CUSTOM_ERROR", error: String(err) } };
        }
      },
      providesTags: ["DiscoverFeed"],
    }),
  }),
});

export const { useGetDiscoverFeedQuery } = discoverApi;
