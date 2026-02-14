import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

export type PresenceRecord = {
  id: string;
  user_id: string;
  place_id: string;
  entered_at: string;
  expires_at: string;
  ended_at: string | null;
  active: boolean;
  lat: number | null;
  lng: number | null;
  entry_type: 'physical' | 'checkin_plus' | 'planning';
  planned_for?: string;  // DATE string (YYYY-MM-DD), only set for planning entries
  planned_period?: string;  // morning|lunch|afternoon|night|late_night
};

export async function refreshPresenceForPlace(
  supabase: SupabaseClient,
  userId: string,
  placeId: string
): Promise<PresenceRecord | null> {
  const nowIso = new Date().toISOString();
  const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { data: presence, error } = await supabase
    .from("user_presences")
    .select("*")
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .eq("active", true)
    .is("ended_at", null)
    .gt("expires_at", nowIso)
    .order("entered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!presence) return null;

  const { data: updated, error: updateError } = await supabase
    .from("user_presences")
    .update({ expires_at: newExpiresAt })
    .eq("id", presence.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated as PresenceRecord;
}
