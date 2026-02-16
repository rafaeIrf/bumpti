import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

// --- Types ---

export interface Milestone {
  threshold: number;
  reward: number;
  achieved: boolean;
  achievedAt?: string;
}

export interface RecurringReward {
  interval: number;
  credits: number;
  timesEarned: number;
  nextAt: number;
}

export interface ReferralStatsResponse {
  totalCreditsEarned: number;
  types: {
    planInvite: {
      acceptedCount: number;
      creditsEarned: number;
      milestones: Milestone[];
      recurring: RecurringReward | null;
    };
  };
}

// --- Cache TTL ---

const CACHE_TIME = {
  REFERRAL_STATS: __DEV__ ? 60 : 180, // 3 min in prod
};

// --- API ---

export const referralApi = createApi({
  reducerPath: "referralApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["ReferralStats"],
  endpoints: (builder) => ({
    getReferralStats: builder.query<ReferralStatsResponse, void>({
      queryFn: async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            return { error: { status: "CUSTOM_ERROR", error: "No active session" } };
          }

          const { data, error } = await supabase.functions.invoke(
            "get-referral-stats",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          if (error) {
            logger.error("[referralApi] Error fetching stats:", error);
            return { error: { status: "CUSTOM_ERROR", error: String(error) } };
          }

          return { data: data as ReferralStatsResponse };
        } catch (err) {
          logger.error("[referralApi] Error:", err);
          return { error: { status: "CUSTOM_ERROR", error: String(err) } };
        }
      },
      providesTags: [{ type: "ReferralStats", id: "current" }],
      keepUnusedDataFor: CACHE_TIME.REFERRAL_STATS,
    }),
  }),
});

export const { useGetReferralStatsQuery } = referralApi;
