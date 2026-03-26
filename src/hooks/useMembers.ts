import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Member, PaymentStatus } from "@/data/types";

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setMembers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const addMember = useCallback(async (m: { name: string; phone: string; monthly_fee: number }) => {
    const { error: err } = await supabase.from("members").insert({
      name: m.name,
      phone: m.phone,
      monthly_fee: m.monthly_fee,
      status: "pending" as PaymentStatus,
      status_label: "New member",
    });
    if (err) return err.message;
    await fetchMembers();
    return null;
  }, [fetchMembers]);

  const updateMember = useCallback(async (id: string, updates: Partial<Pick<Member, "name" | "phone" | "monthly_fee" | "status" | "status_label">>) => {
    const { error: err } = await supabase.from("members").update(updates).eq("id", id);
    if (err) return err.message;
    await fetchMembers();
    return null;
  }, [fetchMembers]);

  const deleteMember = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("members").delete().eq("id", id);
    if (err) return err.message;
    await fetchMembers();
    return null;
  }, [fetchMembers]);

  return { members, loading, error, fetchMembers, addMember, updateMember, deleteMember };
}

export function useMember(id: string | undefined) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    supabase.from("members").select("*").eq("id", id).single()
      .then(({ data }) => { setMember(data); setLoading(false); });
  }, [id]);

  return { member, loading };
}
