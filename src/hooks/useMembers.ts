import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/utils/supabase";
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

  const addMember = useCallback(async (m: { name: string; phone: string; monthly_fee: number; join_date?: string | null; reminder_start_date?: string | null }) => {
    const { error: err } = await supabase.from("members").insert({
      name: m.name,
      phone: m.phone,
      monthly_fee: m.monthly_fee,
      join_date: m.join_date ?? new Date().toISOString().split('T')[0],
      status: "pending" as PaymentStatus,
      // status_label: "New member", // Missing in DB
      // reminder_start_date: m.reminder_start_date ?? null, // Missing in DB
    });
    if (err) return err.message;
    await fetchMembers();
    return null;
  }, [fetchMembers]);

  const updateMember = useCallback(async (id: string, updates: Partial<Pick<Member, "name" | "phone" | "monthly_fee" | "status" | "status_label" | "reminder_start_date" | "next_due_date">>) => {
    // Filter out missing columns
    const { status_label, reminder_start_date, next_due_date, ...validUpdates } = updates as any;
    const { error: err } = await supabase.from("members").update(validUpdates).eq("id", id);
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
