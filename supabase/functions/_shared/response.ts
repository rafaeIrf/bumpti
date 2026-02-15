import { corsHeaders } from "./cors.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

/** Return a JSON success response. */
export function jsonOk<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

/** Return a JSON error response. */
export function jsonError(
  error: string,
  message?: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error, ...(message && { message }), ...extra }),
    { status, headers: jsonHeaders },
  );
}

/** Wrap a handler with CORS preflight, method validation, and error catching. */
export function methodNotAllowed(): Response {
  return jsonError("method_not_allowed", undefined, 405);
}

/** Catch-all error handler for Edge Functions. */
export function internalError(err: unknown): Response {
  const error = err as Error;
  console.error("Edge Function error:", error);
  return jsonError(
    "internal_error",
    error?.message ?? "Unexpected error",
    500,
  );
}
