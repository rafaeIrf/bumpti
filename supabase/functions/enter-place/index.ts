/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { haversineDistance } from "../_shared/haversine.ts";
import { refreshPresenceForPlace } from "../_shared/refresh-presence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_DISTANCE_METERS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env vars");
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => null);
    const place_id = body?.place_id;
    const userLat = typeof body?.userLat === "number" ? body.userLat : null;
    const userLng = typeof body?.userLng === "number" ? body.userLng : null;
    const place_lat = typeof body?.place_lat === "number" ? body.place_lat : null;
    const place_lng = typeof body?.place_lng === "number" ? body.place_lng : null;
    const is_checkin_plus = body?.is_checkin_plus === true;

    if (!place_id || typeof place_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Calculate distance if coordinates available
    let isPhysicallyClose = false;
    let distanceInMeters: number | null = null;
    
    if (userLat !== null && userLng !== null && place_lat !== null && place_lng !== null) {
      distanceInMeters = haversineDistance(userLat, userLng, place_lat, place_lng) * 1000;
      isPhysicallyClose = distanceInMeters <= MAX_DISTANCE_METERS;
      console.log(`Distance: ${distanceInMeters.toFixed(0)}m, isPhysicallyClose: ${isPhysicallyClose}`);
    }

    // FIRST: Check for existing active presence
    const existingPresence = await refreshPresenceForPlace(
      serviceClient,
      user.id,
      place_id
    );

    if (existingPresence) {
      // If user was using checkin_plus but is now physically close, upgrade to physical
      if (existingPresence.entry_type === 'checkin_plus' && isPhysicallyClose) {
        console.log(`Upgrading user ${user.id} from checkin_plus to physical at ${place_id}`);
        const { data: upgraded, error: upgradeError } = await serviceClient
          .from("user_presences")
          .update({ entry_type: 'physical', lat: userLat, lng: userLng })
          .eq("id", existingPresence.id)
          .select()
          .single();
        
        if (upgradeError) {
          console.error("Error upgrading entry_type:", upgradeError);
        } else {
          return new Response(JSON.stringify({ presence: upgraded }), {
            status: 200,
            headers: corsHeaders,
          });
        }
      }
      
      console.log(`User ${user.id} has existing presence at ${place_id}, refreshing`);
      return new Response(JSON.stringify({ presence: existingPresence }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // SECOND: Validate distance for NEW entries only
    let usedCheckinPlus = false;
    
    if (!isPhysicallyClose) {
      if (is_checkin_plus) {
        // User is far but using Check-in+ - allow entry
        usedCheckinPlus = true;
        console.log(`User ${user.id} entering via Check-in+ (distance: ${distanceInMeters?.toFixed(0) ?? 'unknown'}m)`);
      } else {
        // User is far and NOT using Check-in+ - reject
        return new Response(JSON.stringify({ error: "too_far" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    } else {
      console.log(`Distance validation passed: ${distanceInMeters?.toFixed(0)}m`);
    }

    // Determine entry_type based on how user is entering
    const entryType = usedCheckinPlus ? 'checkin_plus' : 'physical';

    const { data, error } = await serviceClient
      .from("user_presences")
      .insert({
        user_id: user.id,
        place_id,
        lat: userLat,
        lng: userLng,
        active: true,
        entry_type: entryType,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created presence for user ${user.id} at ${place_id} with entry_type: ${entryType}`);

    // Consume check-in credit if used
    let remainingCredits: number | undefined;
    if (usedCheckinPlus) {
      const { error: decrementError } = await serviceClient.rpc(
        "decrement_checkin_credit",
        { p_user_id: user.id }
      );
      
      if (decrementError) {
        console.error("Error decrementing check-in credit:", decrementError);
      } else {
        console.log(`Check-in credit consumed for user ${user.id}`);
        
        const { data: updatedCredits } = await serviceClient
          .from("user_checkin_credits")
          .select("credits")
          .eq("user_id", user.id)
          .single();
        
        remainingCredits = updatedCredits?.credits ?? 0;
      }
    }

    return new Response(JSON.stringify({ 
      presence: data,
      remaining_credits: remainingCredits,
    }), {
      status: 201,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error("enterPlace error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
