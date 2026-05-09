import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Payment } from "@/data/types";

export function usePayments(memberId: string | undefined) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!memberId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await api.get<Payment[]>(`/user/payments?member_id=${memberId}`);
    setPayments(data ?? []);
    setLoading(false);
  }, [memberId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const addPayments = useCallback(async (rows: { member_id: string; month: string; date: string; amount: number; status: string }[]) => {
    const { error } = await api.post("/user/payments", { payments: rows });
    if (error) return error;
    await fetchPayments();
    return null;
  }, [fetchPayments]);

  const updatePayment = useCallback(async (id: string, updates: Partial<Pick<Payment, "month" | "date" | "amount" | "status">>) => {
    const { error } = await api.put(`/user/payments/${id}`, updates);
    if (error) return error;
    await fetchPayments();
    return null;
  }, [fetchPayments]);

  return { payments, loading, fetchPayments, addPayments, updatePayment };
}

export function useAllPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Payment[]>("/user/payments")
      .then(({ data }) => { setPayments(data ?? []); setLoading(false); });
  }, []);

  return { payments, loading };
}
