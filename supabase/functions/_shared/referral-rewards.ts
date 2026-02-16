import { grantCheckinCredits } from "./iap-validation.ts";
import { createAdminClient } from "./supabase-admin.ts";

/**
 * Awards checkin+ credits to the invite creator when a new user joins.
 * Counts global joins across all of the creator's invites, checks milestone
 * thresholds, and upserts credits for newly-reached milestones.
 *
 * Safe to call fire-and-forget — errors are caught internally.
 */
export async function processReferralReward(
  admin: ReturnType<typeof createAdminClient>,
  inviteToken: string,
  joinerId: string,
): Promise<void> {
  try {
    // 1. Find the invite by token
    const { data: invite } = await admin
      .from("plan_invites")
      .select("id, creator_id, accepted_count")
      .eq("token", inviteToken)
      .maybeSingle();

    if (!invite || invite.creator_id === joinerId) return; // skip self-joins

    // 2. Log the join (unique constraint prevents double-counts)
    const { error: logErr } = await admin
      .from("invite_join_log")
      .insert({ invite_id: invite.id, joiner_id: joinerId });

    // If unique constraint violated, user already joined via this invite — stop
    if (logErr) return;

    // 2b. Increment accepted_count on the invite (denormalized counter)
    await admin
      .from("plan_invites")
      .update({ accepted_count: (invite.accepted_count ?? 0) + 1 })
      .eq("id", invite.id);

    // 3. Get all invite IDs for this creator
    const { data: creatorInvites } = await admin
      .from("plan_invites")
      .select("id")
      .eq("creator_id", invite.creator_id);

    if (!creatorInvites?.length) return;

    // 4. Count total global joins across all of this creator's invites
    const { count: totalJoins } = await admin
      .from("invite_join_log")
      .select("id", { count: "exact", head: true })
      .in("invite_id", creatorInvites.map((r: { id: string }) => r.id));

    if (!totalJoins) return;

    // 5. Get milestones and check which ones are newly reached
    const [{ data: milestones }, { data: claimedRows }] = await Promise.all([
      admin
        .from("referral_milestones")
        .select("threshold, credits")
        .order("threshold", { ascending: true }),
      admin
        .from("referral_milestone_claims")
        .select("threshold")
        .eq("user_id", invite.creator_id),
    ]);

    if (!milestones) return;

    const claimedSet = new Set(
      (claimedRows ?? []).map((r: { threshold: number }) => r.threshold),
    );

    // 6. Award credits for newly reached, unclaimed milestones
    let creditsToAward = 0;
    const newClaims: { user_id: string; threshold: number }[] = [];

    for (const m of milestones) {
      if (totalJoins >= m.threshold && !claimedSet.has(m.threshold)) {
        creditsToAward += m.credits;
        newClaims.push({ user_id: invite.creator_id, threshold: m.threshold });
      }
    }

    if (creditsToAward > 0 && newClaims.length > 0) {
      // Record milestone claims
      await admin.from("referral_milestone_claims").insert(newClaims);

      // Award credits using shared helper
      await grantCheckinCredits(admin, invite.creator_id, creditsToAward, "referral_reward");

      console.log(
        `[referral-rewards] Awarded ${creditsToAward} credits to ${invite.creator_id} (total joins: ${totalJoins})`,
      );
    }
  } catch (err) {
    // Referral errors must not break the caller
    console.error("[referral-rewards] Error:", err);
  }
}
