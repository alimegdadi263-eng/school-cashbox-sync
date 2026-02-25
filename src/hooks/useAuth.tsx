import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  userRole: string | null;
  schoolName: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    let isMounted = true;

    const resetUserState = () => {
      if (!isMounted) return;
      setUserRole(null);
      setIsAdmin(false);
      setSchoolName("");
    };

    const loadUserData = async (userId: string) => {
      try {
        const [roleRes, profileRes] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("school_name")
            .eq("id", userId)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        const role = roleRes.data?.role || null;
        setUserRole(role);
        setIsAdmin(role === "admin");
        setSchoolName(profileRes.data?.school_name || "");
      } catch (error) {
        console.error("Error fetching user data:", error);
        resetUserState();
      }
    };

    const handleSession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await loadUserData(nextSession.user.id);
      } else {
        resetUserState();
      }

      if (isMounted) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void handleSession(nextSession);
    });

    const init = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await handleSession(initialSession);
      } catch (error) {
        console.error("Error initializing auth:", error);
        resetUserState();
        if (isMounted) setLoading(false);
      }
    };

    void init();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, userRole, schoolName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
