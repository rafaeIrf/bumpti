import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";


const INVITE_BASE_URL = "https://www.bumpti.com/invite/plan";

// ── Types ────────────────────────────────────────────────────────────
export interface PlanInviteDetails {
  token: string;
  expires_at: string;
  presence_id: string;
  place_id: string;
  place_name: string | null;
  place_category: string | null;
  place_neighborhood: string | null;
  planned_for: string;
  planned_period: "morning" | "afternoon" | "night";
  creator: {
    id: string;
    display_name: string | null;
    photo_url: string | null;
  };
}

// ── Create Plan Invite ───────────────────────────────────────────────
/**
 * Creates an invite link for a plan. If one already exists, reuses it.
 * Returns the full invite URL or null on failure.
 */
export async function createPlanInvite(
  presenceId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      token: string;
      invite_url: string;
      expires_at: string;
    }>("create-plan-invite", {
      body: { presence_id: presenceId },
    });

    if (error) {
      logger.error("[PlanInvite] Error creating invite:", error);
      return null;
    }

    return data?.invite_url ?? null;
  } catch (err) {
    logger.error("[PlanInvite] Unexpected error creating invite:", err);
    return null;
  }
}

// ── Get Plan Invite Details ──────────────────────────────────────────
/**
 * Fetches plan invite details from a token.
 * Used by the join-plan modal to show plan preview.
 */
export async function getPlanInviteDetails(
  token: string,
): Promise<PlanInviteDetails | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      invite: PlanInviteDetails;
    }>("get-plan-invite", {
      body: { token },
    });

    if (error) {
      logger.error("[PlanInvite] Error fetching invite:", error);
      return null;
    }

    return data?.invite ?? null;
  } catch (err) {
    logger.error("[PlanInvite] Unexpected error fetching invite:", err);
    return null;
  }
}

// ── Build Invite URL ─────────────────────────────────────────────────
/**
 * Constructs an invite URL from a token.
 */
export function buildInviteUrl(token: string): string {
  return `${INVITE_BASE_URL}/${token}`;
}
