export type PlanPeriod = "morning" | "afternoon" | "night";
export type PlanDay = "today" | "tomorrow";

export interface CreatePlanPayload {
  placeId: string;
  placeName: string;
  period: PlanPeriod;
  day: PlanDay;
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
