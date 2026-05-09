import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Member } from "@/data/types";

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await api.get<Member[]>("/user/members");
    if (err) setError(err);
    else setMembers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const addMember = useCallback(async (m: {
    full_name: string;
    mobile: string;
    email?: string | null;
    plan_id: string;
    join_date?: string | null;
    next_due_date?: string | null;
  }) => {
    const { error: err } = await api.post("/user/members", m);
    if (err) return err;
    await fetchMembers();
    return null;
  }, [fetchMembers]);

  const updateMember = useCallback(async (id: string, updates: Partial<Pick<Member, "full_name" | "mobile" | "email" | "plan_id" | "join_date" | "next_due_date">>) => {
    const { error: err } = await api.put(`/user/members/${id}`, updates);
    if (err) return err;
    await fetchMembers();
    return null;
  }, [fetchMembers]);

  const deleteMember = useCallback(async (id: string) => {
    const { error: err } = await api.delete(`/user/members/${id}`);
    if (err) return err;
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
    api.get<Member>(`/user/members/${id}`)
      .then(({ data }) => { setMember(data); setLoading(false); });
  }, [id]);

  return { member, loading };
}
