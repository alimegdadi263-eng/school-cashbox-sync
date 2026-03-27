// Android SMS Gateway integration via backend proxy
// Supports both Local (LAN) and Cloud modes

const SMS_GATEWAY_KEY = "sms_gateway_config";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/sms-proxy`;

export type GatewayMode = "local" | "cloud";

export interface SmsGatewayConfig {
  mode: GatewayMode;
  serverUrl: string;
  login: string;
  password: string;
  deviceId: string;
  simNumber?: number; // 1 or 2 for dual-SIM phones
}

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

function getAuthToken(config: SmsGatewayConfig): string {
  return btoa(`${config.login}:${config.password}`);
}

export async function sendSmsViaGateway(
  config: SmsGatewayConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
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
