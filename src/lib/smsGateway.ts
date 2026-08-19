// Android SMS Gateway integration via backend proxy
// Supports both Local (LAN) and Cloud modes
// Supports multiple gateway profiles for load distribution

const SMS_GATEWAY_KEY = "sms_gateway_config";
const SMS_GATEWAYS_KEY = "sms_gateway_profiles";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/sms-proxy`;

export type GatewayMode = "local" | "cloud";
export type GatewayProvider = "smsgate" | "master";

export interface SmsGatewayConfig {
  id?: string;
  name?: string; // e.g. "هاتف أحمد", "هاتف محمد"
  provider?: GatewayProvider; // default "smsgate" (legacy)
  mode: GatewayMode;
  serverUrl: string;
  login: string;
  password: string;
  deviceId: string;
  simNumber?: number;
  // --- SMS Gateway Master (API key) ---
  apiKey?: string;
  sendPath?: string; // default "/sendsms"
  httpMethod?: "GET" | "POST"; // default "GET"
  apiKeyParam?: string; // default "apikey"
  phoneParam?: string; // default "number"
  messageParam?: string; // default "message"
  simParam?: string; // default "sim"
}

export const MASTER_DEFAULTS = {
  sendPath: "/sendsms",
  httpMethod: "GET" as const,
  apiKeyParam: "apikey",
  phoneParam: "number",
  messageParam: "message",
  simParam: "sim",
};

export function isMaster(c: SmsGatewayConfig) {
  return c.provider === "master";
}

function masterUrl(config: SmsGatewayConfig, phone?: string, message?: string) {
  const base = (config.serverUrl || "").replace(/\/$/, "");
  const path = config.sendPath || MASTER_DEFAULTS.sendPath;
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set(config.apiKeyParam || MASTER_DEFAULTS.apiKeyParam, config.apiKey || "");
  if (phone !== undefined) url.searchParams.set(config.phoneParam || MASTER_DEFAULTS.phoneParam, phone);
  if (message !== undefined) url.searchParams.set(config.messageParam || MASTER_DEFAULTS.messageParam, message);
  if (config.simNumber) url.searchParams.set(config.simParam || MASTER_DEFAULTS.simParam, String(config.simNumber));
  return url.toString();
}

// Send through SMS Gateway Master (direct HTTP call to the phone / server, API key auth)
async function sendViaMaster(
  config: SmsGatewayConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.serverUrl) return { success: false, error: "عنوان السيرفر مفقود" };
    if (!config.apiKey) return { success: false, error: "مفتاح API مفقود" };

    const method = config.httpMethod || MASTER_DEFAULTS.httpMethod;
    let res: Response;

    if (method === "POST") {
      const base = (config.serverUrl || "").replace(/\/$/, "");
      const path = config.sendPath || MASTER_DEFAULTS.sendPath;
      res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          [config.apiKeyParam || MASTER_DEFAULTS.apiKeyParam]: config.apiKey,
          [config.phoneParam || MASTER_DEFAULTS.phoneParam]: phone,
          [config.messageParam || MASTER_DEFAULTS.messageParam]: message,
          ...(config.simNumber ? { [config.simParam || MASTER_DEFAULTS.simParam]: config.simNumber } : {}),
        }),
      });
    } else {
      res = await fetch(masterUrl(config, phone, message), {
        method: "GET",
        headers: { "X-API-KEY": config.apiKey },
      });
    }

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const text = await res.text();
    if (/"?(success|status)"?\s*[:=]\s*"?(false|error|failed)"?/i.test(text)) {
      return { success: false, error: text.slice(0, 200) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "فشل الاتصال بالبوابة" };
  }
}


// --- Multi-profile management ---

export function loadGatewayProfiles(): SmsGatewayConfig[] {
  try {
    const raw = localStorage.getItem(SMS_GATEWAYS_KEY);
    if (raw) {
      const profiles = JSON.parse(raw) as SmsGatewayConfig[];
      return profiles.map(p => ({
        ...p,
        id: p.id || generateProfileId(),
        mode: p.mode || "cloud",
        deviceId: p.deviceId || "",
      }));
    }
    // Migrate from single config
    const single = loadGatewayConfig();
    if (single) {
      const profile = { ...single, id: generateProfileId(), name: "الهاتف الأساسي" };
      saveGatewayProfiles([profile]);
      return [profile];
    }
    return [];
  } catch {
    return [];
  }
}

export function saveGatewayProfiles(profiles: SmsGatewayConfig[]) {
  localStorage.setItem(SMS_GATEWAYS_KEY, JSON.stringify(profiles));
  // Also keep first profile as legacy config for backward compat
  if (profiles.length > 0) {
    saveGatewayConfig(profiles[0]);
  }
}

function generateProfileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- Legacy single config (backward compat) ---

export function loadGatewayConfig(): SmsGatewayConfig | null {
  try {
    const raw = localStorage.getItem(SMS_GATEWAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.mode) parsed.mode = "local";
    if (!parsed.deviceId) parsed.deviceId = "";
    return parsed;
  } catch {
    return null;
  }
}

export function saveGatewayConfig(config: SmsGatewayConfig) {
  localStorage.setItem(SMS_GATEWAY_KEY, JSON.stringify(config));
}

// --- API calls ---

function getAuthToken(config: SmsGatewayConfig): string {
  return btoa(`${config.login}:${config.password}`);
}

export async function sendSmsViaGateway(
  config: SmsGatewayConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (isMaster(config)) return sendViaMaster(config, phone, message);
  try {
    const auth = getAuthToken(config);


    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-sms-auth": auth,
        "x-sms-mode": config.mode,
        "x-sms-server": config.serverUrl || "",
        "x-sms-action": "send",
      },
      body: JSON.stringify({
        deviceId: config.deviceId,
        phoneNumbers: [phone],
        message: message,
        ...(config.simNumber ? { simNumber: config.simNumber } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${text}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل الاتصال بالبوابة" };
  }
}

export async function testGatewayConnection(
  config: SmsGatewayConfig
): Promise<boolean> {
  try {
    const auth = getAuthToken(config);

    const res = await fetch(PROXY_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-sms-auth": auth,
        "x-sms-mode": config.mode,
        "x-sms-server": config.serverUrl || "",
        "x-sms-action": "test",
      },
    });

    return res.ok;
  } catch {
    return false;
  }
}

// Send bulk SMS with round-robin across multiple profiles
export async function sendBulkSmsViaGateway(
  config: SmsGatewayConfig,
  messages: { phone: string; text: string }[],
  onProgress?: (sent: number, total: number, failed: string[]) => void
): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  const failed: { phone: string; error: string }[] = [];
  let sent = 0;

  for (const msg of messages) {
    const result = await sendSmsViaGateway(config, msg.phone, msg.text);
    if (result.success) {
      sent++;
    } else {
      failed.push({ phone: msg.phone, error: result.error || "خطأ غير معروف" });
    }
    onProgress?.(sent, messages.length, failed.map((f) => f.phone));
    await new Promise((r) => setTimeout(r, 300));
  }

  return { sent, failed };
}

// Send bulk SMS distributed across multiple gateway profiles (round-robin)
export async function sendBulkSmsMultiGateway(
  profiles: SmsGatewayConfig[],
  messages: { phone: string; text: string }[],
  onProgress?: (sent: number, total: number, failed: string[]) => void
): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  if (profiles.length === 0) {
    return { sent: 0, failed: messages.map(m => ({ phone: m.phone, error: "لا توجد بوابات" })) };
  }
  if (profiles.length === 1) {
    return sendBulkSmsViaGateway(profiles[0], messages, onProgress);
  }

  const failed: { phone: string; error: string }[] = [];
  let sent = 0;

  for (let i = 0; i < messages.length; i++) {
    const profile = profiles[i % profiles.length]; // round-robin
    const msg = messages[i];
    const result = await sendSmsViaGateway(profile, msg.phone, msg.text);
    if (result.success) {
      sent++;
    } else {
      failed.push({ phone: msg.phone, error: result.error || "خطأ غير معروف" });
    }
    onProgress?.(sent, messages.length, failed.map((f) => f.phone));
    await new Promise((r) => setTimeout(r, 200));
  }

  return { sent, failed };
}
