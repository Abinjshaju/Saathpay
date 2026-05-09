import { useAuth } from "@/context/AuthContext";

export function useUserProfile() {
  const { user, refreshProfile } = useAuth();
  return { profile: user, refreshProfile };
}
