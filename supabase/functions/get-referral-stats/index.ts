import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RECURRING_INTERVAL = 5;
const RECURRING_CREDITS = 1;

interface ReferralStatsResponse {
  totalCreditsEarned: number;
  types: {
    planInvite: {
      acceptedCount: number;
      creditsEarned: number;
      milestones: {
        threshold: number;
        reward: number;
        achieved: boolean;
        achievedAt?: string;
      }[];
      recurring: {
        interval: number;
        credits: number;
        timesEarned: number;
        nextAt: number;
      } | null;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get all fixed milestones from config table
    const { data: allMilestones, error: milestonesError } = await supabase
      .from("referral_milestones")
      .select("threshold, credits")
      .order("threshold", { ascending: true });

    if (milestonesError) {
      throw milestonesError;
    }

    // 2. Get user's claimed milestones (includes both fixed + recurring)
    const { data: claims, error: claimsError } = await supabase
      .from("referral_milestone_claims")
      .select("threshold, claimed_at")
      .eq("user_id", user.id);

    if (claimsError) {
      throw claimsError;
    }

    const claimedThresholds = new Set(claims?.map((c) => c.threshold) || []);
    const claimsMap = new Map(
      claims?.map((c) => [c.threshold, c.claimed_at]) || []
    );

    // 3. Count accepted invites
    const { data: inviteStats, error: inviteStatsError } = await supabase
      .from("plan_invites")
      .select("accepted_count")
      .eq("creator_id", user.id);

    if (inviteStatsError) {
      throw inviteStatsError;
    }

    const totalAcceptedCount = inviteStats?.reduce(
      (sum, invite) => sum + (invite.accepted_count || 0),
      0
    ) || 0;

    // 4. Build fixed milestones array
    const highestMilestoneThreshold = allMilestones?.length
      ? allMilestones[allMilestones.length - 1].threshold
      : 0;

    const milestones = allMilestones?.map((milestone) => ({
      threshold: milestone.threshold,
      reward: milestone.credits,
      achieved: claimedThresholds.has(milestone.threshold),
      achievedAt: claimsMap.get(milestone.threshold) || undefined,
    })) || [];

    // 5. Calculate fixed milestone credits
    const fixedCredits = milestones
      .filter((m) => m.achieved)
      .reduce((sum, m) => sum + m.reward, 0);

    // 6. Calculate recurring rewards
    let recurringData = null;
    let recurringCreditsEarned = 0;

    if (highestMilestoneThreshold > 0) {
      const acceptsBeyond = Math.max(0, totalAcceptedCount - highestMilestoneThreshold);
      const totalRecurringSlots = Math.floor(acceptsBeyond / RECURRING_INTERVAL);

      // Count how many recurring slots have been claimed
      let timesEarned = 0;
      for (let slot = 1; slot <= totalRecurringSlots; slot++) {
        const recurringThreshold = highestMilestoneThreshold + (slot * RECURRING_INTERVAL);
        if (claimedThresholds.has(recurringThreshold)) {
          timesEarned++;
          recurringCreditsEarned += RECURRING_CREDITS;
        }
      }

      // Next recurring threshold
      const nextSlot = timesEarned + 1;
      const nextAt = highestMilestoneThreshold + (nextSlot * RECURRING_INTERVAL);

      recurringData = {
        interval: RECURRING_INTERVAL,
        credits: RECURRING_CREDITS,
        timesEarned,
        nextAt,
      };
    }

    const totalCreditsEarned = fixedCredits + recurringCreditsEarned;

    const response: ReferralStatsResponse = {
      totalCreditsEarned,
      types: {
        planInvite: {
          acceptedCount: totalAcceptedCount,
          creditsEarned: totalCreditsEarned,
          milestones,
          recurring: recurringData,
        },
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
