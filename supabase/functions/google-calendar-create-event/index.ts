import { createAdminClient, corsHeaders, decryptSecret, googleClientId, googleClientSecret, jsonResponse, originAllowed, requireUser } from "../_shared/common.ts";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
function nextDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("วันครบกำหนดไม่ถูกต้อง");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId(), client_secret: googleClientSecret(),
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error === "invalid_grant"
      ? "Google authorization หมดอายุหรือถูกเพิกถอน กรุณาเชื่อม Google Calendar ใหม่ในหน้าตั้งค่า"
      : "ไม่สามารถต่ออายุสิทธิ์ Google Calendar ได้");
  }
  return data.access_token as string;
}
Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
  if (!originAllowed(origin)) return jsonResponse({ error: "Origin is not allowed" }, 403, origin);

  let userId: string | null = null;
  let homeworkId: string | null = null;
  const admin = createAdminClient();
  try {
    const user = await requireUser(request);
    userId = user.id;
    const payload = await request.json();
    homeworkId = typeof payload.homeworkId === "string" ? payload.homeworkId : null;
    if (!homeworkId || !/^[0-9a-f-]{36}$/i.test(homeworkId)) return jsonResponse({ error: "homeworkId ไม่ถูกต้อง" }, 400, origin);

    const { data: homework, error: homeworkError } = await admin.from("homework")
      .select("id, user_id, record_kind, hw_name, hw_type, subject, due_date, notes, calendar_event_id, calendar_event_link")
      .eq("id", homeworkId).eq("user_id", user.id).maybeSingle();
    if (homeworkError) throw homeworkError;
    if (!homework) return jsonResponse({ error: "ไม่พบรายการการบ้านของบัญชีนี้" }, 404, origin);
    if (homework.record_kind !== "homework" || !homework.due_date) return jsonResponse({ connected: false, skipped: true, reason: "no_homework_due_date" }, 200, origin);


    const { data: storedToken, error: tokenError } = await admin.from("google_calendar_tokens")
      .select("refresh_token_ciphertext, refresh_token_iv").eq("user_id", user.id).maybeSingle();
    if (tokenError) throw tokenError;
    if (!storedToken) return jsonResponse({ connected: false, created: false, reason: "not_connected" }, 200, origin);

    const refreshToken = await decryptSecret(storedToken.refresh_token_ciphertext, storedToken.refresh_token_iv);
    const accessToken = await refreshAccessToken(refreshToken);
    // UUID hex plus a permitted base32hex prefix gives a stable id, making retries idempotent.
    const eventId = "h" + homework.id.replaceAll("-", "").toLowerCase();
    const requestedColorId = payload.calendarColorId == null || payload.calendarColorId === ""
      ? null
      : String(payload.calendarColorId);
    const allowedColorIds = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    if (requestedColorId !== null && !allowedColorIds.has(requestedColorId)) {
      return jsonResponse({ error: "calendarColorId ไม่ถูกต้อง" }, 400, origin);
    }
    const event = {
      id: eventId,
      ...(requestedColorId ? { colorId: requestedColorId } : {}),
      summary: `StudyFlow: ${homework.hw_name} — ${homework.subject}`,
      description: [
        `ประเภท: ${homework.hw_type}`,
        `วิชา: ${homework.subject}`,
        homework.notes ? `รายละเอียด: ${homework.notes}` : "",
        "เพิ่มจาก StudyFlow",
        "https://chakris13.github.io/StudyFlow-Demo/",
      ].filter(Boolean).join("\n"),
      start: { date: homework.due_date },
      end: { date: nextDate(homework.due_date) },
      reminders: { useDefault: true },
    };
    const updateExisting = payload.updateExisting === true && Boolean(homework.calendar_event_id);
    const eventUrl = updateExisting ? GOOGLE_EVENTS_URL + "/" + encodeURIComponent(homework.calendar_event_id) : GOOGLE_EVENTS_URL;
    let response = await fetch(eventUrl, {
      method: updateExisting ? "PATCH" : "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(updateExisting ? Object.fromEntries(Object.entries(event).filter(([key]) => key !== "id")) : event),
    });
    let eventData = await response.json();
    if (response.status === 409) {
      response = await fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      eventData = await response.json();
    }
    if (!response.ok || !eventData.id) {
      const message = eventData.error?.message || "Google Calendar ไม่สามารถสร้าง Event ได้";
      await admin.from("homework").update({ calendar_sync_error: message.slice(0, 500) }).eq("id", homework.id).eq("user_id", user.id);
      return jsonResponse({ connected: true, created: false, error: message }, 502, origin);
    }

    const { error: updateError } = await admin.from("homework").update({
      calendar_event_id: eventData.id,
      calendar_event_link: eventData.htmlLink ?? null,
      calendar_sync_error: null,
    }).eq("id", homework.id).eq("user_id", user.id);
    if (updateError) throw updateError;
    return jsonResponse({ connected: true, created: true, eventId: eventData.id, htmlLink: eventData.htmlLink ?? null }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถสร้าง Google Calendar Event ได้";
    if (userId && homeworkId) {
      await admin.from("homework").update({ calendar_sync_error: message.slice(0, 500) }).eq("id", homeworkId).eq("user_id", userId);
    }
    return jsonResponse({ connected: !!userId, created: false, error: message }, 400, origin);
  }
});
