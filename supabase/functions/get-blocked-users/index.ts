/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const userPhotosBucket = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Fetch blocked users for the current user and their profile details
    const { data: blocks, error: blocksError } = await supabase
      .from("user_blocks")
      .select(`
        blocked_user_id:blocked_id,
        created_at,
        blocked_profile:profiles!blocked_id (
          id,
          name
        )
      `)
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    if (blocksError) {
      console.error("Error fetching blocked users:", blocksError);
      return new Response(
        JSON.stringify({ error: "fetch_failed", details: blocksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract blocked user IDs to fetch photos
    const blockedUserIds = (blocks || []).map((b: any) => b.blocked_user_id);

    // Fetch photos for these users if there are any
    let photosMap: Record<string, string> = {};
    
    if (blockedUserIds.length > 0) {
      const { data: photos, error: photosError } = await supabase
        .from("profile_photos")
        .select("user_id, url, position")
        .in("user_id", blockedUserIds)
        .order("position", { ascending: true });

      if (photosError) {
         console.error("Error fetching blocked user photos:", photosError);
      } else if (photos) {
        for (const photo of photos) {
          if (!photosMap[photo.user_id]) {
             photosMap[photo.user_id] = photo.url;
          }
        }
      }
    }

    // Process and format the data
    const blockedUsers = await Promise.all(
      (blocks || []).map(async (block: any) => {
        let photoUrl = null;
        const rawPhotoPath = photosMap[block.blocked_user_id];

        if (rawPhotoPath) {
           const { data: signedData } = await supabase.storage
             .from(userPhotosBucket)
             .createSignedUrl(rawPhotoPath, 60 * 60 * 24); // 24 hours
           
           if (signedData?.signedUrl) {
             photoUrl = signedData.signedUrl;
           }
        }

        return {
          blocked_user_id: block.blocked_user_id,
          created_at: block.created_at,
          user_details: {
            id: block.blocked_profile?.id,
            firstName: block.blocked_profile?.name || "User",
            photoUrl: photoUrl
          }
        };
      })
    );

    return new Response(JSON.stringify(blockedUsers), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("get-blocked-users edge error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unexpected error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
