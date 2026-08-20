// ==============================================================
//  Traccar SMS Gateway integration (Android)
// --------------------------------------------------------------
//  Official API of the "Traccar SMS Gateway" Android app:
//    POST http://<phone-ip>:<port>/
//    Headers: Authorization: <API key shown in the app>
//             Content-Type: application/json
//    Body:    { "to": "<phone>", "message": "<text>" }
//
//  The app answers 200 on success, 401 when the key is wrong.
//  There is NO official endpoint for listing devices and NO
//  official parameter for choosing a SIM card, so neither is
//  implemented here (no invented endpoints / parameters).
//
//  In the Electron desktop build the request is executed by the
//  main process (no CORS restrictions). In the browser preview it
//  falls back to a normal fetch.
// ==============================================================

const SMS_GATEWAY_KEY = "sms_gateway_config";
const SMS_GATEWAYS_KEY = "sms_gateway_profiles";

export const TRACCAR_DEFAULT_PORT = 8082;

export interface SmsGatewayConfig {
  id?: string;
  name?: string; // e.g. "هاتف المدرسة"
  host: string; // IP or hostname of the Android phone, e.g. 192.168.1.5
  port: number; // default 8082
  apiKey: string; // Authorization header value (from the app)
}

// ---------------- storage ----------------

function generateProfileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function normalizeProfile(p: any): SmsGatewayConfig {
  return {
    id: p?.id || generateProfileId(),
    name: p?.name || "هاتف الإرسال",
    host: (p?.host ?? p?.serverUrl ?? "").toString().replace(/^https?:\/\//, "").replace(/[/:].*$/, ""),
    port: Number(p?.port) > 0 ? Number(p.port) : TRACCAR_DEFAULT_PORT,
    apiKey: p?.apiKey || "",
  };
}

export function loadGatewayProfiles(): SmsGatewayConfig[] {
  try {
    const raw = localStorage.getItem(SMS_GATEWAYS_KEY);
    if (raw) return (JSON.parse(raw) as any[]).map(normalizeProfile);
    const single = loadGatewayConfig();
    if (single && single.host) {
      saveGatewayProfiles([single]);
      return [single];
    }
    return [];
  } catch {
    return [];
  }
}

export function saveGatewayProfiles(profiles: SmsGatewayConfig[]) {
  localStorage.setItem(SMS_GATEWAYS_KEY, JSON.stringify(profiles));
  if (profiles.length > 0) saveGatewayConfig(profiles[0]);
}

export function loadGatewayConfig(): SmsGatewayConfig | null {
  try {
    const raw = localStorage.getItem(SMS_GATEWAY_KEY);
    if (!raw) return null;
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGatewayConfig(config: SmsGatewayConfig) {
  localStorage.setItem(SMS_GATEWAY_KEY, JSON.stringify(config));
}

// ---------------- transport ----------------

export function gatewayUrl(config: SmsGatewayConfig): string {
  const host = (config.host || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const port = config.port || TRACCAR_DEFAULT_PORT;
  return `http://${host}:${port}/`;
}

interface HttpResult {
  ok: boolean;
  status: number;
  body: string;
  networkError?: string;
}

/** Traccar SMS Gateway builds differ in how the Local Service Token must be
 *  sent. We try the documented variants in order and remember the one that
 *  the phone accepted, so later messages go out with a single request. */
function authVariants(token: string): string[] {
  const t = (token || "").trim();
  if (!t) return [""];
  const basic = typeof btoa === "function" ? btoa(`:${t}`) : "";
  return [t, `Bearer ${t}`, basic ? `Basic ${basic}` : t];
}

const acceptedAuth = new Map<string, string>();

function authCacheKey(c: SmsGatewayConfig) {
  return `${gatewayUrl(c)}|${c.apiKey}`;
}

async function rawRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResult> {
  const bridge = (window as any)?.electronAPI?.sms?.request;
  if (bridge) {
    try {
      const r = await bridge({ url, method, headers, body: body || "" });
      if (r?.error) return { ok: false, status: 0, body: "", networkError: r.error };
      return { ok: r.status >= 200 && r.status < 300, status: r.status, body: r.body || "" };
    } catch (e: any) {
      return { ok: false, status: 0, body: "", networkError: e?.message || "فشل الاتصال" };
    }
  }
  try {
    const res = await fetch(url, { method, headers, body });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: text };
  } catch (e: any) {
    return { ok: false, status: 0, body: "", networkError: e?.message || "فشل الاتصال" };
  }
}

/** POST the Traccar payload, trying each auth style until one is accepted. */
async function httpPostAuth(config: SmsGatewayConfig, payload: unknown): Promise<HttpResult> {
  const url = gatewayUrl(config);
  const body = JSON.stringify(payload);
  const key = authCacheKey(config);
  const cached = acceptedAuth.get(key);
  const variants = cached
    ? [cached, ...authVariants(config.apiKey).filter((v) => v !== cached)]
    : authVariants(config.apiKey);

  let last: HttpResult = { ok: false, status: 0, body: "", networkError: "فشل الاتصال" };
  for (const auth of variants) {
    const res = await rawRequest(url, "POST", {
      // charset=utf-8 ضروري حتى تصل الرسائل العربية سليمة وليست رموزًا غريبة
      "Content-Type": "application/json; charset=utf-8",
      Authorization: auth,
    }, body);
    if (res.networkError) return res; // phone unreachable — no point retrying
    if (res.ok) {
      acceptedAuth.set(key, auth);
      return res;
    }
    last = res;
    if (res.status !== 401 && res.status !== 403) return res; // real error, not auth
  }
  return last;
}

function friendlyError(res: HttpResult): string {
  if (res.networkError) {
    return "تعذر الاتصال بالهاتف — تأكد أن تطبيق Traccar SMS Gateway يعمل وأن الهاتف على نفس الشبكة، ومن صحة العنوان والمنفذ.";
  }
  switch (res.status) {
    case 401:
    case 403:
      return "فشل المصادقة — Token غير صحيح. انسخ Local Service → Token من داخل تطبيق Traccar (وليس Cloud Token).";
    case 404:
      return "المسار غير صحيح — تأكد من رقم المنفذ (Port) الظاهر في التطبيق.";
    case 400:
      return `طلب غير صالح: ${res.body.slice(0, 150) || "تحقق من رقم الهاتف ونص الرسالة"}`;
    case 500:
      return "فشل إرسال الرسالة من الهاتف — تأكد من وجود شريحة SIM ومن منح التطبيق صلاحية إرسال الرسائل.";
    default:
      return `فشل الإرسال (HTTP ${res.status}) ${res.body.slice(0, 150)}`.trim();
  }
}

function validate(config: SmsGatewayConfig): string | null {
  if (!config?.host) return "عنوان الهاتف (IP) غير محدد";
  if (!config?.port) return "المنفذ (Port) غير محدد";
  if (!config?.apiKey) return "Local Service Token غير محدد";
  return null;
}

// ---------------- public API ----------------

export async function sendSmsViaGateway(
  config: SmsGatewayConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const invalid = validate(config);
  if (invalid) return { success: false, error: invalid };

  const res = await httpPostAuth(config, { to: phone, message });
  if (res.ok) return { success: true };
  return { success: false, error: friendlyError(res) };
}

/** Connection test: first check the phone answers at all (GET / returns the
 *  Traccar info page), then verify the token with an empty payload POST. */
export async function testGatewayConnection(
  config: SmsGatewayConfig
): Promise<{ success: boolean; error?: string }> {
  const invalid = validate(config);
  if (invalid) return { success: false, error: invalid };

  const reach = await rawRequest(gatewayUrl(config), "GET", {});
  if (reach.networkError) return { success: false, error: friendlyError(reach) };

  const res = await httpPostAuth(config, { to: "", message: "" });
  if (res.networkError) return { success: false, error: friendlyError(res) };
  if (res.status === 401 || res.status === 403) return { success: false, error: friendlyError(res) };
  if (res.status === 404) return { success: false, error: friendlyError(res) };
  return { success: true };
}


/** Try every configured phone until one of them accepts the message.
 *  Useful when phones belong to different Wi-Fi networks: the unreachable
 *  ones simply fail fast and the next one takes over. */
export async function sendSmsAnyGateway(
  profiles: SmsGatewayConfig[],
  phone: string,
  message: string,
  startIndex = 0
): Promise<{ success: boolean; error?: string; usedIndex?: number }> {
  const usable = profiles.filter((p) => !validate(p));
  if (usable.length === 0) {
    return { success: false, error: "لا توجد بوابة إرسال مكتملة الإعدادات" };
  }
  let lastError = "";
  for (let i = 0; i < usable.length; i++) {
    const idx = (startIndex + i) % usable.length;
    const res = await sendSmsViaGateway(usable[idx], phone, message);
    if (res.success) return { success: true, usedIndex: idx };
    lastError = `${usable[idx].name || "هاتف"}: ${res.error}`;
  }
  return { success: false, error: lastError };
}

export async function sendBulkSmsViaGateway(
  config: SmsGatewayConfig,
  messages: { phone: string; text: string }[],
  onProgress?: (sent: number, total: number, failed: string[]) => void
): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  return sendBulkSmsMultiGateway([config], messages, onProgress);
}

/** Distribute messages across several phones (round-robin) with automatic
 *  failover: if the chosen phone is unreachable the message is retried on the
 *  other phones before being marked as failed. */
export async function sendBulkSmsMultiGateway(
  profiles: SmsGatewayConfig[],
  messages: { phone: string; text: string }[],
  onProgress?: (sent: number, total: number, failed: string[]) => void
): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  const usable = profiles.filter((p) => !validate(p));
  if (usable.length === 0) {
    return { sent: 0, failed: messages.map((m) => ({ phone: m.phone, error: "لا توجد بوابات" })) };
  }

  const failed: { phone: string; error: string }[] = [];
  let sent = 0;
  let cursor = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const result = await sendSmsAnyGateway(usable, msg.phone, msg.text, cursor);
    if (result.success) {
      sent++;
      // keep rotating from the phone that worked
      cursor = ((result.usedIndex ?? cursor) + 1) % usable.length;
    } else {
      failed.push({ phone: msg.phone, error: result.error || "خطأ غير معروف" });
    }
    onProgress?.(sent, messages.length, failed.map((f) => f.phone));
    await new Promise((r) => setTimeout(r, 250));
  }

  return { sent, failed };
}

