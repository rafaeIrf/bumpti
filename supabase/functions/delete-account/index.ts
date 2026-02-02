import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    // Use requireAuth for consistent auth handling
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult;

    // Get service role key for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for deletion
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // STEP 1: Fetch user data BEFORE deletion (will need after DB delete)
    let photoUrls: string[] = [];
    let diditSessionId: string | null = null;
    let verificationStatus: string | null = null;
    
    try {
      // Fetch photos
      const { data: photos, error: photosError } = await serviceClient
        .from('profile_photos')
        .select('url')
        .eq('user_id', user.id);

      if (photosError) {
        console.warn('Error fetching photos for deletion:', photosError);
      } else if (photos && photos.length > 0) {
        photoUrls = photos.map((p: { url: string }) => p.url);
        console.log(`Found ${photoUrls.length} photos to delete for user ${user.id}`);
      }

      // Fetch Didit session ID for GDPR-compliant deletion
      const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('didit_session_id, verification_status')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.warn('Error fetching profile for Didit deletion:', profileError);
      } else if (profile) {
        diditSessionId = profile.didit_session_id;
        verificationStatus = profile.verification_status;
        if (diditSessionId) {
          console.log(`Found Didit session ID for user ${user.id}: ${diditSessionId}`);
        }
      }
    } catch (error) {
      console.warn('Exception while fetching user data:', error);
      // Continue with deletion even if we can't fetch
    }

    // STEP 2: Delete user from database FIRST (atomic transaction)
    // WORKAROUND: Auth API deleteUser() fails with "Database error"
    // Use database function instead that deletes directly via SQL
    // This will cascade to profile_photos table
    const { data: deleteResult, error: deleteError } = await serviceClient
      .rpc('delete_user_completely', { target_user_id: user.id });

    if (deleteError) {
      console.error("Error deleting user via RPC:", deleteError);
      // Database deletion failed - Storage was NOT touched
      return new Response(
        JSON.stringify({
          error: "delete_failed",
          message: deleteError.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deleteResult?.success) {
      console.error("Database function returned error:", deleteResult);
      // Database deletion failed - Storage was NOT touched
      return new Response(
        JSON.stringify({
          error: "delete_failed",
          message: deleteResult?.error || "Failed to delete user",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully deleted user from database:", user.id);

    // STEP 3: Delete photos from Storage (ONLY after successful DB deletion)
    // If this fails, it's not critical - user is already deleted from DB
    if (photoUrls.length > 0) {
      try {
        // URLs in profile_photos are stored as relative paths: "user_id/photo_id.jpg"
        // We can use them directly for Storage deletion
        console.log('Deleting files from Storage:', photoUrls);
        const { data: removeData, error: removeError } = await serviceClient
          .storage
          .from('user_photos')
          .remove(photoUrls);

        if (removeError) {
          console.error('Error deleting photos from Storage:', removeError);
          console.error('Failed paths:', photoUrls);
          // Don't fail the response - user is already deleted from DB
          // Storage cleanup can be done manually if needed
        } else {
          console.log('Successfully deleted photos from Storage');
          console.log('Deleted files:', removeData);
        }
      } catch (storageError) {
        console.error('Exception while deleting photos from Storage:', storageError);
        console.error('Attempted paths:', photoUrls);
        // Don't fail the response - user is already deleted from DB
      }
    }

    // STEP 4: Delete verification data from Didit (GDPR/LGPD compliance)
    // Only attempt if user had verification status pending or verified
    if (diditSessionId && (verificationStatus === 'verified' || verificationStatus === 'pending')) {
      try {
        const diditApiKey = Deno.env.get("DIDIT_API_KEY");
        const diditApiUrl = Deno.env.get("DIDIT_API_URL") || "https://verification.didit.me";

        if (!diditApiKey) {
          console.warn('DIDIT_API_KEY not configured - skipping Didit deletion');
        } else {
          console.log(`Attempting to delete Didit verification data for session: ${diditSessionId}`);
          
          // Call Didit API to delete verification data
          // Endpoint: https://verification.didit.me/v3/session/{sessionId}/delete/
          // This deletes biometric data, document photos, and verification metadata
          const diditResponse = await fetch(`${diditApiUrl}/v3/session/${diditSessionId}/delete/`, {
            method: 'DELETE',
            headers: {
              'x-api-key': diditApiKey,
              'accept': 'application/json',
            },
          });

          if (diditResponse.ok) {
            console.log('Successfully deleted Didit verification data for user:', user.id);
          } else {
            const errorText = await diditResponse.text();
            console.error('Failed to delete Didit verification data:', {
              status: diditResponse.status,
              statusText: diditResponse.statusText,
              error: errorText,
              session_id: diditSessionId,
            });
            // Don't fail the operation - user is already deleted from our DB
            // This is logged for manual cleanup if needed
          }
        }
      } catch (diditError) {
        console.error('Exception while deleting Didit verification data:', diditError);
        console.error('Session ID:', diditSessionId);
        // Don't fail - user is deleted from our systems
        // Didit data may need manual cleanup via Didit dashboard if API call failed
      }
    } else if (diditSessionId) {
      console.log('User had Didit session but status was not verified/pending - skipping deletion');
    }


    console.log("Successfully deleted user:", user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("delete-account edge error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
