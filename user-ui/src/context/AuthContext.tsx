import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, getToken, setToken, clearToken } from "@/lib/api";
import type { UserProfile } from "@/data/types";

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: UserProfile | null;
  login: (identifier: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(): Promise<UserProfile | null> {
  const { data, error } = await api.get<UserProfile>("/users/me");
  if (error || !data) return null;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for existing token and fetch profile
  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchProfile().then((profile) => {
        setUser(profile);
        if (!profile) clearToken(); // token was invalid/expired
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<string | null> => {
    const { data, error } = await api.post<{ access_token: string; user: UserProfile }>(
      "/users/login",
      { identifier, password },
    );
    if (error || !data) return error || "Login failed";
    setToken(data.access_token);
    setUser(data.user);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/users/logout").catch(() => {});
    clearToken();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await fetchProfile();
    setUser(profile);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        loading,
        user,
        login,
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
