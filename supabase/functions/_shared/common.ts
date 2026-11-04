import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://chakris13.github.io",
]);

export function originAllowed(origin: string | null): boolean {
  return !!origin && ALLOWED_ORIGINS.has(origin);
}
export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": originAllowed(origin) ? origin! : "https://chakris13.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
export function jsonResponse(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function readKey(jsonName: string, legacyName: string): string {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  const raw = Deno.env.get(jsonName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const candidate = parsed.default ?? Object.values(parsed)[0];
      if (typeof candidate === "string" && candidate) return candidate;
    } catch { /* report a configuration error below */ }
  }
  throw new Error(`Missing Supabase server key: ${legacyName}`);
}
export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return createClient(url, readKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function requireUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("กรุณาเข้าสู่ระบบ StudyFlow ก่อนเชื่อม Google Calendar");
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is not configured");
  const token = authorization.slice("Bearer ".length);
  const userClient = createClient(url, readKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error("Session StudyFlow หมดอายุ กรุณาเข้าสู่ระบบใหม่");
  if (data.user.is_anonymous) throw new Error("ต้องใช้บัญชี StudyFlow ที่ลงทะเบียนแล้ว จึงจะเชื่อม Google Calendar ได้");
  return data.user;
}
export function googleClientId(): string {
  const value = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!value) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ใน Supabase Edge Function Secrets");
  return value;
}
export function googleClientSecret(): string {
  const value = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!value) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_SECRET ใน Supabase Edge Function Secrets");
  return value;
}
function encryptionKeyBytes(): Uint8Array {
  const value = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!value) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_TOKEN_ENCRYPTION_KEY ใน Supabase Edge Function Secrets");
  const raw = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (raw.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY ต้องเป็น Base64 ของข้อมูล 32 bytes");
  return raw;
}
async function encryptionKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encryptionKeyBytes(), { name: "AES-GCM" }, false, usages);
}
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export async function encryptSecret(value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(["encrypt"]),
    new TextEncoder().encode(value),
  );
  return { ciphertext: base64(new Uint8Array(encrypted)), iv: base64(iv) };
}
export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(iv) },
    await encryptionKey(["decrypt"]),
    decode(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function randomState(): string {
  return base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export function siteSettingsUrl(calendarStatus: string): string {
  const url = new URL("https://chakris13.github.io/StudyFlow-Demo/Settings.html");
  url.searchParams.set("calendar", calendarStatus);
  return url.toString();
}
