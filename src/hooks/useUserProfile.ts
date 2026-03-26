import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useCallback } from "react";

export function useUserProfile() {
  const { user, refreshProfile } = useAuth();

  const updateProfile = useCallback(async (updates: { business_name?: string; api_key?: string; secret_key?: string }) => {
    if (!user) return "Not authenticated";
    const { error } = await supabase.from("users").update(updates).eq("id", user.id);
    if (error) return error.message;
    await refreshProfile();
    return null;
  }, [user, refreshProfile]);

  return { profile: user, updateProfile };
}
