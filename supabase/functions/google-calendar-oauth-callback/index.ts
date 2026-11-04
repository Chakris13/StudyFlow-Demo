import { createAdminClient, encryptSecret, googleClientId, googleClientSecret, sha256Hex, siteSettingsUrl } from "../_shared/common.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/google-calendar-oauth-callback`;
function redirect(status: string): Response {
  return new Response(null, { status: 302, headers: { "Location": siteSettingsUrl(status), "Cache-Control": "no-store" } });
}
Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");
  if (!state) return redirect("error");
  try {
    const admin = createAdminClient();
    const stateHash = await sha256Hex(state);
    const { data: stateRow, error: stateError } = await admin.from("google_calendar_oauth_states")
      .select("user_id, expires_at").eq("state_hash", stateHash).maybeSingle();
    if (stateError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
      await admin.from("google_calendar_oauth_states").delete().eq("state_hash", stateHash);
      return redirect("expired");
    }
    await admin.from("google_calendar_oauth_states").delete().eq("state_hash", stateHash);
    if (googleError || !code) return redirect("denied");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: googleClientId(), client_secret: googleClientSecret(),
        redirect_uri: CALLBACK_URL, grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("Google OAuth token exchange failed:", tokenData.error);
      return redirect("token_error");
    }

    let refreshToken = tokenData.refresh_token as string | undefined;
    if (!refreshToken) {
      const { data: existing } = await admin.from("google_calendar_tokens")
        .select("user_id").eq("user_id", stateRow.user_id).maybeSingle();
      if (existing) return redirect("connected");
      return redirect("no_refresh_token");
    }

    const encrypted = await encryptSecret(refreshToken);
    const { error: saveError } = await admin.from("google_calendar_tokens").upsert({
      user_id: stateRow.user_id,
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      token_scope: tokenData.scope ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) {
      console.error("Could not save Google Calendar token:", saveError.message);
      return redirect("save_error");
    }
    return redirect("connected");
  } catch (error) {
    console.error("Google Calendar OAuth callback failed:", error instanceof Error ? error.message : "unknown error");
    return redirect("error");
  }
});
