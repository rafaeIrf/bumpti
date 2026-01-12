import type { SyncChanges } from "./types.ts";
import { corsHeaders } from "../cors.ts";

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function counts(changes: SyncChanges) {
  return {
    created: changes.created.length,
    updated: changes.updated.length,
    deleted: changes.deleted.length,
  };
}
