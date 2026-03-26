import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Member, Payment } from "@/data/types";

interface DashboardStats {
  totalMembers: number;
  paymentReceived: number;
  failedCount: number;
  paidCount: number;
  overdueCount: number;
  pendingCount: number;
  upcoming: Member[];
  revenueByMonth: { label: string; value: number }[];
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [membersRes, paymentsRes] = await Promise.all([
        supabase.from("members").select("*"),
        supabase.from("payments").select("*").eq("status", "paid"),
      ]);

      const members: Member[] = membersRes.data ?? [];
      const paidPayments: Payment[] = paymentsRes.data ?? [];

      const totalMembers = members.length;
      const paidCount = members.filter((m) => m.status === "paid").length;
      const overdueCount = members.filter((m) => m.status === "overdue").length;
      const pendingCount = members.filter((m) => m.status === "pending").length;
      const failedCount = members.filter((m) => m.status === "overdue" || m.status === "failed").length;
      const upcoming = members.filter((m) => m.status === "pending");

      const paymentReceived = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const monthMap = new Map<string, number>();
      for (const p of paidPayments) {
        const key = p.month;
        monthMap.set(key, (monthMap.get(key) ?? 0) + Number(p.amount));
      }

      const revenueByMonth = Array.from(monthMap.entries())
        .slice(-4)
        .map(([label, value]) => ({ label, value }));

      setStats({
        totalMembers,
        paymentReceived,
        failedCount,
        paidCount,
        overdueCount,
        pendingCount,
        upcoming,
        revenueByMonth,
      });
      setLoading(false);
    }
    load();
  }, []);

  return { stats, loading };
}
