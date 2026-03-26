import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/data/types";
import type { Session } from "@supabase/supabase-js";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, businessName: string, phone: string, businessType: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).then((p) => {
          setUser(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).then(setUser);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const register = useCallback(async (email: string, password: string, businessName: string, phone: string, businessType: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName || "My Gym",
          phone: phone || null,
          business_type: businessType || "gym",
        },
      },
    });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      const p = await fetchProfile(session.user.id);
      setUser(p);
    }
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        loading,
        user,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
