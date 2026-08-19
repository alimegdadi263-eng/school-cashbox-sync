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

async function httpPost(url: string, apiKey: string, payload: unknown): Promise<HttpResult> {
  const bridge = (window as any)?.electronAPI?.sms?.request;
  const headers = { "Content-Type": "application/json", Authorization: apiKey };
  const body = JSON.stringify(payload);

  if (bridge) {
    try {
      const r = await bridge({ url, method: "POST", headers, body });
      if (r?.error) return { ok: false, status: 0, body: "", networkError: r.error };
      return { ok: r.status >= 200 && r.status < 300, status: r.status, body: r.body || "" };
    } catch (e: any) {
      return { ok: false, status: 0, body: "", networkError: e?.message || "فشل الاتصال" };
    }
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: text };
  } catch (e: any) {
    return { ok: false, status: 0, body: "", networkError: e?.message || "فشل الاتصال" };
  }
}

function friendlyError(res: HttpResult): string {
  if (res.networkError) {
    return "تعذر الاتصال بتطبيق Traccar SMS Gateway. تأكد من تشغيل التطبيق واتصال الهاتف بالشبكة، ومن صحة العنوان والمنفذ.";
  }
  switch (res.status) {
    case 401:
    case 403:
      return "مفتاح API غير صحيح (Authorization) — انسخه من داخل تطبيق Traccar.";
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
  if (!config?.apiKey) return "مفتاح API غير محدد";
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

  const res = await httpPost(gatewayUrl(config), config.apiKey, { to: phone, message });
  if (res.ok) return { success: true };
  return { success: false, error: friendlyError(res) };
}

/** Connection test: the app answers 401 for a bad key and 400 for an empty
 *  payload, both of which prove it is reachable. */
export async function testGatewayConnection(
  config: SmsGatewayConfig
): Promise<{ success: boolean; error?: string }> {
  const invalid = validate(config);
  if (invalid) return { success: false, error: invalid };

  const res = await httpPost(gatewayUrl(config), config.apiKey, { to: "", message: "" });
  if (res.networkError) return { success: false, error: friendlyError(res) };
  if (res.status === 401 || res.status === 403) return { success: false, error: friendlyError(res) };
  if (res.status === 404) return { success: false, error: friendlyError(res) };
  return { success: true };
}

export async function sendBulkSmsViaGateway(
  config: SmsGatewayConfig,
  messages: { phone: string; text: string }[],
  onProgress?: (sent: number, total: number, failed: string[]) => void
): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  const failed: { phone: string; error: string }[] = [];
  let sent = 0;

  for (const msg of messages) {
    const result = await sendSmsViaGateway(config, msg.phone, msg.text);
    if (result.success) sent++;
    else failed.push({ phone: msg.phone, error: result.error || "خطأ غير معروف" });
    onProgress?.(sent, messages.length, failed.map((f) => f.phone));
    await new Promise((r) => setTimeout(r, 300));
  }

  return { sent, failed };
}

/** Distribute messages across several phones (round-robin). Each message is
 *  sent exactly once — a failure is recorded and the loop continues. */
export async function sendBulkSmsMultiGateway(
  profiles: SmsGatewayConfig[],
  messages: { phone: string; text: string }[],
  onProgress?: (sent: number, total: number, failed: string[]) => void
): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  if (profiles.length === 0) {
    return { sent: 0, failed: messages.map((m) => ({ phone: m.phone, error: "لا توجد بوابات" })) };
  }
  if (profiles.length === 1) return sendBulkSmsViaGateway(profiles[0], messages, onProgress);

  const failed: { phone: string; error: string }[] = [];
  let sent = 0;

  for (let i = 0; i < messages.length; i++) {
    const profile = profiles[i % profiles.length];
    const msg = messages[i];
    const result = await sendSmsViaGateway(profile, msg.phone, msg.text);
    if (result.success) sent++;
    else failed.push({ phone: msg.phone, error: result.error || "خطأ غير معروف" });
    onProgress?.(sent, messages.length, failed.map((f) => f.phone));
    await new Promise((r) => setTimeout(r, 200));
  }

  return { sent, failed };
}
