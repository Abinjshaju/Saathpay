import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Payment, PaymentStatus } from "@/data/types";

export function usePayments(memberId: string | undefined) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!memberId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    setPayments(data ?? []);
    setLoading(false);
  }, [memberId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const addPayment = useCallback(async (p: { member_id: string; month: string; date: string; amount: number; status: PaymentStatus }) => {
    const { error } = await supabase.from("payments").insert(p);
    if (error) return error.message;
    await fetchPayments();
    return null;
  }, [fetchPayments]);

  const updatePayment = useCallback(async (id: string, updates: Partial<Pick<Payment, "month" | "date" | "amount" | "status">>) => {
    const { error } = await supabase.from("payments").update(updates).eq("id", id);
    if (error) return error.message;
    await fetchPayments();
    return null;
  }, [fetchPayments]);

  return { payments, loading, fetchPayments, addPayment, updatePayment };
}

export function useAllPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("payments").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setPayments(data ?? []); setLoading(false); });
  }, []);

  return { payments, loading };
}
