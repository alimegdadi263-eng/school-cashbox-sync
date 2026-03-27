import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLOUD_API_URL = "https://api.sms-gate.app/api/3rdparty/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sms-auth, x-sms-mode, x-sms-server",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const smsAuth = req.headers.get("x-sms-auth") || "";
    const smsMode = req.headers.get("x-sms-mode") || "cloud";
    const smsServer = req.headers.get("x-sms-server") || "";

    const baseUrl = smsMode === "cloud" ? CLOUD_API_URL : smsServer.replace(/\/$/, "");
    const url = `${baseUrl}/message`;

    const proxyHeaders: Record<string, string> = {
      "Authorization": `Basic ${smsAuth}`,
    };

    let body: string | undefined;
    if (req.method === "POST") {
      body = await req.text();
      proxyHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method: req.method,
      headers: proxyHeaders,
      body,
    });

    const responseText = await res.text();

    return new Response(responseText, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
