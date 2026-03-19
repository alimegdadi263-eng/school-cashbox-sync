import React, { createContext, useContext, useState, useCallback } from "react";

type NetworkMode = "standalone" | "server" | "client";

interface NetworkState {
  mode: NetworkMode;
  serverIp: string;
  serverPort: number;
  localIPs: { name: string; address: string }[];
  connected: boolean;
  error: string | null;
}

interface NetworkContextType {
  state: NetworkState;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  connectToServer: (ip: string, port?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  isNetworkMode: boolean;
  getData: (key: string) => Promise<any>;
  setData: (key: string, data: any) => Promise<void>;
  ping: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const initialState: NetworkState = {
  mode: "standalone",
  serverIp: "",
  serverPort: 9753,
  localIPs: [],
  connected: false,
  error: null,
};

function getElectronLan() {
  return (window as any)?.electronAPI?.lan;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState>(initialState);

  const startServer = useCallback(async () => {
    const lan = getElectronLan();
    if (!lan) {
      setState(s => ({ ...s, error: "ميزة الشبكة متاحة فقط في تطبيق سطح المكتب" }));
      return;
    }
    setState(s => ({ ...s, error: null }));
    const result = await lan.startServer();
    if (result.success) {
      setState(s => ({
        ...s,
        mode: "server",
        serverPort: result.port,
        localIPs: result.ips || [],
        connected: true,
        error: null,
      }));
    } else {
      setState(s => ({ ...s, error: result.error }));
    }
  }, []);

  const stopServer = useCallback(async () => {
    const lan = getElectronLan();
    if (!lan) return;
    await lan.stopServer();
    setState(initialState);
  }, []);

  const connectToServer = useCallback(async (ip: string, port = 9753) => {
    const lan = getElectronLan();
    if (!lan) {
      setState(s => ({ ...s, error: "ميزة الشبكة متاحة فقط في تطبيق سطح المكتب" }));
      return;
    }
    setState(s => ({ ...s, error: null }));
    const result = await lan.connect(ip, port);
    if (result.success) {
      setState(s => ({
        ...s,
        mode: "client",
        serverIp: ip,
        serverPort: port,
        connected: true,
        error: null,
      }));
    } else {
      setState(s => ({ ...s, error: result.error }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    const lan = getElectronLan();
    if (!lan) return;
    await lan.disconnect();
    setState(initialState);
  }, []);

  const getData = useCallback(async (key: string) => {
    const lan = getElectronLan();
    if (!lan) return null;
    const result = await lan.getData(key);
    return result?.data ?? null;
  }, []);

  const setData = useCallback(async (key: string, data: any) => {
    const lan = getElectronLan();
    if (!lan) return;
    await lan.setData(key, data);
  }, []);

  const ping = useCallback(async () => {
    const lan = getElectronLan();
    if (!lan) return false;
    try {
      const result = await lan.ping();
      const ok = result?.success === true;
      setState(s => ({ ...s, connected: ok }));
      return ok;
    } catch {
      setState(s => ({ ...s, connected: false }));
      return false;
    }
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        state,
        startServer,
        stopServer,
        connectToServer,
        disconnect,
        isNetworkMode: state.mode !== "standalone",
        getData,
        setData,
        ping,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
