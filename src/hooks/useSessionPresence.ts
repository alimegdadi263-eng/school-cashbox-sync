import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * تتبّع الجلسات النشطة (Active Sessions)
 * ---------------------------------------
 * الهدف: معرفة إذا كان نفس الحساب (يوزر/باسوورد) مفتوحاً على أكثر من جهاز
 * في نفس الوقت، حتى يستطيع المدير (Admin) رؤية ذلك وإيقاف الحساب.
 *
 * الآلية:
 * 1. يُنشأ لكل جهاز معرّف ثابت (device_id) يُحفظ في localStorage.
 * 2. عند تسجيل الدخول يُسجَّل صف في جدول active_sessions ويُحدَّث كل دقيقة (نبضة).
 * 3. المدير يرى في صفحة "إدارة المستخدمين" أي حساب له أكثر من جهاز نشِط
 *    خلال آخر 5 دقائق.
 * 4. عند تسجيل الخروج يُحذف صف الجهاز.
 */

const DEVICE_KEY = "app_device_id";
const HEARTBEAT_MS = 60_000;

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** وصف مبسّط للجهاز يظهر للمدير */
function getDeviceLabel(): string {
  const ua = navigator.userAgent || "";
  const isElectron = ua.includes("Electron") || typeof (window as any).electronAPI !== "undefined";
  let os = "غير معروف";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `${isElectron ? "برنامج سطح المكتب" : "متصفح"} - ${os}`;
}

/** حذف جلسة الجهاز الحالي (يُستدعى عند تسجيل الخروج) */
export async function clearSessionPresence(userId: string) {
  try {
    await supabase
      .from("active_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("device_id", getDeviceId());
  } catch (e) {
    console.error("clearSessionPresence error", e);
  }
}

export function useSessionPresence(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const beat = async () => {
      if (cancelled) return;
      try {
        await supabase.from("active_sessions").upsert(
          {
            user_id: userId,
            device_id: getDeviceId(),
            device_label: getDeviceLabel(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_id" }
        );
      } catch (e) {
        console.error("session heartbeat error", e);
      }
    };

    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId]);
}
