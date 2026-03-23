import { useCallback, useRef, useEffect } from "react";

function getElectronLan() {
  return (window as any)?.electronAPI?.lan;
}

async function isLanConnected(): Promise<{ connected: boolean; mode: string }> {
  const lan = getElectronLan();
  if (!lan) return { connected: false, mode: "standalone" };
  try {
    const result = await lan.isConnected();
    return { connected: result?.connected === true, mode: result?.mode || "standalone" };
  } catch {
    return { connected: false, mode: "standalone" };
  }
}

/** Save data to localStorage AND to LAN server if connected */
export async function lanSave(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
  const { connected } = await isLanConnected();
  if (connected) {
    const lan = getElectronLan();
    try {
      await lan.setData(key, data);
    } catch (err) {
      console.error("LAN save error:", err);
    }
  }
}

/** Load data from LAN server (if client) or localStorage */
export async function lanLoad<T>(key: string, fallback: T): Promise<T> {
  const { connected, mode } = await isLanConnected();
  if (connected && mode === "client") {
    const lan = getElectronLan();
    try {
      const result = await lan.getData(key);
      if (result?.success && result.data != null) {
        // Also update localStorage as cache
        localStorage.setItem(key, JSON.stringify(result.data));
        return result.data as T;
      }
    } catch (err) {
      console.error("LAN load error:", err);
    }
  }
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return fallback;
}

/**
 * Hook that provides periodic LAN sync for a given set of keys.
 * When in client mode, pulls data from server every interval.
 */
export function useLanSync(
  keys: string[],
  onDataReceived: (key: string, data: any) => void,
  intervalMs = 5000
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const startSync = () => {
      timerRef.current = setInterval(async () => {
        const { connected, mode } = await isLanConnected();
        if (!connected || mode !== "client") return;
        const lan = getElectronLan();
        if (!lan) return;

        for (const key of keys) {
          try {
            const result = await lan.getData(key);
            if (result?.success && result.data != null) {
              const currentStr = localStorage.getItem(key);
              const newStr = JSON.stringify(result.data);
              if (currentStr !== newStr) {
                localStorage.setItem(key, newStr);
                onDataReceived(key, result.data);
              }
            }
          } catch {}
        }
      }, intervalMs);
    };

    startSync();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [keys.join(","), intervalMs]);
}
