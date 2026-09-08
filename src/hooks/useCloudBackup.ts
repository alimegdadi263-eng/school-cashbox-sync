import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * النسخ الاحتياطي السحابي التلقائي
 * ---------------------------------
 * الهدف: أن يبقى كل عمل المستخدم (المعلمون، الجداول، الطلبة، البيانات المالية...)
 * محفوظاً حتى بعد تسجيل الخروج أو تغيير الجهاز أو إعادة تثبيت البرنامج.
 *
 * الآلية:
 * 1. جميع بيانات البرمجية تُحفظ محلياً في localStorage (كما هو الحال سابقاً).
 * 2. عند تسجيل الدخول: تُجلب النسخة السحابية من جدول user_backups وتُدمج محلياً
 *    (الأحدث يفوز) ثم تُعاد تهيئة الصفحة مرة واحدة لتقرأ البيانات الجديدة.
 * 3. أثناء العمل: أي تغيير على localStorage يُرصد ويُرفع للسحابة بعد ثانيتين (debounce).
 * 4. عند تسجيل الخروج: تُرفع آخر نسخة قبل الخروج فعلياً.
 *
 * ملاحظة: لا تُرفع مفاتيح الجلسة أو كلمات المرور أو معرّف الجهاز.
 */

const SKIP_PREFIXES = ["sb-", "supabase.", "app_device_id", "ajyal_creds", "AJYAL_CREDS"];
const LOCAL_STAMP_PREFIX = "__cloud_stamp__";
const PUSH_DEBOUNCE_MS = 2000;

function shouldSync(key: string) {
  if (!key) return false;
  if (key.startsWith(LOCAL_STAMP_PREFIX)) return false;
  return !SKIP_PREFIXES.some((p) => key.toLowerCase().startsWith(p.toLowerCase()));
}

function localStamp(key: string): number {
  const raw = localStorage.getItem(LOCAL_STAMP_PREFIX + key);
  return raw ? Number(raw) || 0 : 0;
}

function setLocalStamp(key: string, ts: number) {
  try {
    localStorage.setItem(LOCAL_STAMP_PREFIX + key, String(ts));
  } catch {
    /* تجاهل */
  }
}

/** يرصد كل تعديل على localStorage ويستدعي callback */
function patchLocalStorage(onChange: (key: string) => void) {
  const proto = Storage.prototype as Storage & { __cloudPatched?: boolean };
  if (proto.__cloudPatched) return () => {};
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  proto.setItem = function (key: string, value: string) {
    originalSet.call(this, key, value);
    if (this === window.localStorage && shouldSync(key)) onChange(key);
  };
  proto.removeItem = function (key: string) {
    originalRemove.call(this, key);
    if (this === window.localStorage && shouldSync(key)) onChange(key);
  };
  proto.__cloudPatched = true;
  return () => {
    proto.setItem = originalSet;
    proto.removeItem = originalRemove;
    proto.__cloudPatched = false;
  };
}

export type CloudBackupStatus = "idle" | "restoring" | "saving" | "saved" | "error";

export function useCloudBackup(userId: string | null) {
  const [status, setStatus] = useState<CloudBackupStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);

  // رفع المفاتيح المعلّقة إلى السحابة
  const flush = useRef(async (uid: string) => {
    const keys = Array.from(pendingRef.current);
    pendingRef.current.clear();
    if (!keys.length) return;
    const rows = keys.map((key) => {
      const raw = localStorage.getItem(key);
      let parsed: unknown = raw;
      if (raw != null) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }
      return { user_id: uid, data_key: key, value: raw == null ? null : (parsed as never) };
    });
    try {
      setStatus("saving");
      const { error } = await supabase.from("user_backups").upsert(rows, { onConflict: "user_id,data_key" });
      if (error) throw error;
      const now = Date.now();
      keys.forEach((k) => setLocalStamp(k, now));
      setLastSyncedAt(new Date(now));
      setStatus("saved");
    } catch (e) {
      console.error("cloud backup push error", e);
      keys.forEach((k) => pendingRef.current.add(k));
      setStatus("error");
    }
  }).current;

  useEffect(() => {
    if (!userId) {
      readyRef.current = false;
      return;
    }
    let cancelled = false;

    const queue = (key: string) => {
      if (!readyRef.current) return;
      pendingRef.current.add(key);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(userId), PUSH_DEBOUNCE_MS);
    };

    const unpatch = patchLocalStorage(queue);

    const restore = async () => {
      setStatus("restoring");
      try {
        const { data, error } = await supabase
          .from("user_backups")
          .select("data_key, value, updated_at")
          .eq("user_id", userId);
        if (error) throw error;
        if (cancelled) return;

        let changed = 0;
        for (const row of data || []) {
          const key = row.data_key as string;
          if (!shouldSync(key)) continue;
          const remoteTs = new Date(row.updated_at as string).getTime();
          const current = localStorage.getItem(key);
          const remoteValue = row.value == null ? null : JSON.stringify(row.value);
          if (remoteValue == null) continue;
          const isNewer = remoteTs > localStamp(key);
          if (current == null || (isNewer && current !== remoteValue)) {
            localStorage.setItem(key, remoteValue);
            setLocalStamp(key, remoteTs);
            changed++;
          }
        }

        // رفع أي بيانات محلية غير موجودة في السحابة
        const remoteKeys = new Set((data || []).map((r) => r.data_key as string));
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !shouldSync(key) || remoteKeys.has(key)) continue;
          pendingRef.current.add(key);
        }

        readyRef.current = true;
        setLastSyncedAt(new Date());
        setStatus("saved");
        if (pendingRef.current.size) void flush(userId);
        if (changed > 0) {
          // إعادة تحميل مرة واحدة حتى تقرأ الشاشات البيانات المستعادة
          const marker = `cloud_restored_${userId}`;
          if (!sessionStorage.getItem(marker)) {
            sessionStorage.setItem(marker, "1");
            window.location.reload();
          }
        }
      } catch (e) {
        console.error("cloud backup restore error", e);
        readyRef.current = true;
        setStatus("error");
      }
    };

    void restore();

    const onBeforeUnload = () => {
      if (pendingRef.current.size) void flush(userId);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
      unpatch();
    };
  }, [userId, flush]);

  /** رفع فوري لكل البيانات (يُستخدم قبل تسجيل الخروج أو عند الضغط على "حفظ الآن") */
  const backupNow = async () => {
    if (!userId) return;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && shouldSync(key)) pendingRef.current.add(key);
    }
    await flush(userId);
  };

  return { status, lastSyncedAt, backupNow };
}
