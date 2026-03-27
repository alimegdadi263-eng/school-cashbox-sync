import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLOUD_API_BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sms-auth, x-sms-mode, x-sms-server, x-sms-action",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const smsAuth = req.headers.get("x-sms-auth") || "";
    const smsMode = req.headers.get("x-sms-mode") || "cloud";
    const smsServer = req.headers.get("x-sms-server") || "";
    const smsAction = req.headers.get("x-sms-action") || (req.method === "GET" ? "test" : "send");

    const baseUrl = smsMode === "cloud"
      ? CLOUD_API_BASE_URL
      : `${smsServer.replace(/\/$/, "")}/3rdparty/v1`;

    const targetPath = smsAction === "test"
      ? "/devices"
      : "/messages?skipPhoneValidation=true&deviceActiveWithin=12";

    const proxyHeaders: Record<string, string> = {
      Authorization: `Basic ${smsAuth}`,
    };

    let body: string | undefined;
    if (req.method === "POST") {
      body = await req.text();
      proxyHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(`${baseUrl}${targetPath}`, {
      method: req.method,
      headers: proxyHeaders,
      body,
    });

    const responseText = await res.text();

    return new Response(responseText, {
      status: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
