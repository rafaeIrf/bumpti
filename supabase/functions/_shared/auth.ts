import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { jsonError } from "./response.ts";

type AuthSuccess = { success: true; supabase: any; user: any };
type AuthFailure = { success: false; response: Response };

/**
 * Validates the Authorization header and returns the authenticated user.
 * On failure, returns a ready-to-send Response.
 */
export async function requireAuth(
  req: Request,
): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { success: false, response: jsonError("unauthorized", "Missing Authorization header", 401) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return { success: false, response: jsonError("server_error", "Missing Supabase environment variables", 500) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, response: jsonError("unauthorized", "Invalid or expired token", 401) };
  }

  return { success: true, supabase, user };
}
