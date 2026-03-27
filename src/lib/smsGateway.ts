// Android SMS Gateway integration
// Supports both Local (LAN) and Cloud modes

const SMS_GATEWAY_KEY = "sms_gateway_config";
const CLOUD_API_URL = "https://sms.capcom6.ru/api/3rdparty/v1";

export type GatewayMode = "local" | "cloud";

export interface SmsGatewayConfig {
  mode: GatewayMode;
  serverUrl: string; // For local mode: http://192.168.1.5:8080
  login: string;
  password: string;
}

export function loadGatewayConfig(): SmsGatewayConfig | null {
  try {
    const raw = localStorage.getItem(SMS_GATEWAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate old config without mode
    if (!parsed.mode) parsed.mode = "local";
    return parsed;
  } catch {
    return null;
  }
}

export function saveGatewayConfig(config: SmsGatewayConfig) {
  localStorage.setItem(SMS_GATEWAY_KEY, JSON.stringify(config));
}

function getBaseUrl(config: SmsGatewayConfig): string {
  if (config.mode === "cloud") return CLOUD_API_URL;
  return config.serverUrl.replace(/\/$/, "");
}

export async function sendSmsViaGateway(
  config: SmsGatewayConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = getBaseUrl(config);
    const url = `${baseUrl}/message`;
    const auth = btoa(`${config.login}:${config.password}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        message,
        phoneNumbers: [phone],
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
    const baseUrl = getBaseUrl(config);
    const auth = btoa(`${config.login}:${config.password}`);
    const res = await fetch(`${baseUrl}/message`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    // Any response (even 405 Method Not Allowed) means server is reachable
    return true;
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
    onProgress?.(sent, messages.length, failed.map(f => f.phone));
    await new Promise(r => setTimeout(r, 300));
  }

  return { sent, failed };
}
