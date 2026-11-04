import { createAdminClient, corsHeaders, jsonResponse, originAllowed, randomState, requireUser, sha256Hex, googleClientId } from "../_shared/common.ts";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/google-calendar-oauth-callback`;
const REQUIRED_SCOPE = "https://www.googleapis.com/auth/calendar.events";
Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders(origin) } });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
  if (!originAllowed(origin)) return jsonResponse({ error: "Origin is not allowed" }, 403, origin);
  try {
    const user = await requireUser(request);
    const admin = createAdminClient();
    await admin.from("google_calendar_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const state = randomState();
    const stateHash = await sha256Hex(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: stateError } = await admin.from("google_calendar_oauth_states")
      .insert({ state_hash: stateHash, user_id: user.id, expires_at: expiresAt });
    if (stateError) throw new Error("ไม่สามารถเริ่มการเชื่อม Google Calendar ได้: " + stateError.message);
    const params = new URLSearchParams({
      client_id: googleClientId(), redirect_uri: CALLBACK_URL, response_type: "code",
      scope: REQUIRED_SCOPE, access_type: "offline", prompt: "consent select_account",
      include_granted_scopes: "true", state,
    });
    return jsonResponse({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, expiresInSeconds: 600 }, 200, origin);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "เริ่มการเชื่อมต่อไม่สำเร็จ" }, 400, origin);
  }
});
