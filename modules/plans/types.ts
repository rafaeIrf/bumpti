export type PlanPeriod = "morning" | "afternoon" | "night";
/** Day offset from today: 0 = today, 1 = tomorrow, … 6 = 6 days from now */
export type PlanDay = number;

export interface CreatePlanPayload {
  placeId: string;
  placeName: string;
  period: PlanPeriod;
  day: PlanDay;
}

/** Used when joining via invite — date params already resolved from the invite. */
export interface JoinPlanPayload {
  placeId: string;
  plannedFor: string;   // "YYYY-MM-DD"
  period: PlanPeriod;
  expiresAt: string;    // ISO 8601
  inviteToken?: string; // Token from invite link (for referral rewards)
}

export interface UserPlan {
  id: string;
  place_id: string;
  place_name: string | null;
  place_category: string | null;
  planned_for: string; // YYYY-MM-DD
  planned_period: PlanPeriod;
  active_users: number;
}

export interface SuggestedPlan {
  place_id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  plan_count: number;
  distance: number;
}
