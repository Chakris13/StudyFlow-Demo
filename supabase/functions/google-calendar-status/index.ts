import { createAdminClient, corsHeaders, jsonResponse, originAllowed, requireUser } from "../_shared/common.ts";
Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);
  if (!originAllowed(origin)) return jsonResponse({ error: "Origin is not allowed" }, 403, origin);
  try {
    const user = await requireUser(request);
    const { data, error } = await createAdminClient().from("google_calendar_tokens")
      .select("user_id, updated_at").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return jsonResponse({ connected: !!data, updatedAt: data?.updated_at ?? null }, 200, origin);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "ตรวจสอบสถานะไม่สำเร็จ" }, 400, origin);
  }
});
