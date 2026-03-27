// Android SMS Gateway integration
// App: https://github.com/capcom6/android-sms-gateway (free, open source)

const SMS_GATEWAY_KEY = "sms_gateway_config";

export interface SmsGatewayConfig {
  serverUrl: string; // e.g. http://192.168.1.5:8080
  login: string;
  password: string;
}

export function loadGatewayConfig(): SmsGatewayConfig | null {
  try {
    const raw = localStorage.getItem(SMS_GATEWAY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGatewayConfig(config: SmsGatewayConfig) {
  localStorage.setItem(SMS_GATEWAY_KEY, JSON.stringify(config));
}

export async function sendSmsViaGateway(
  config: SmsGatewayConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${config.serverUrl.replace(/\/$/, "")}/message`;
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
    // Small delay between messages
    await new Promise(r => setTimeout(r, 300));
  }

  return { sent, failed };
}
