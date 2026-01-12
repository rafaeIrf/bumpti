import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export async function requireAuth(req: Request): Promise<
  | { success: true; supabase: any; user: any }
  | { success: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: "unauthorized", message: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: "server_error", message: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { success: true, supabase, user };
}
