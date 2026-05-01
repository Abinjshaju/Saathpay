import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { nextBillingDateFromReminder, isDueWithinNextDays } from "@/lib/billingDates";
import { monthKeyFromDate } from "@/lib/months";
import type { Member, Payment } from "@/data/types";

const UPCOMING_WINDOW_DAYS = 30;

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
      const currentMonthKey = monthKeyFromDate(new Date());
      const paidCurrentMonthMemberIds = new Set(
        paidPayments
          .filter((p) => p.month === currentMonthKey && p.status === "paid")
          .map((p) => p.member_id),
      );
      const today = new Date();
      const upcoming = members
        .filter(
          (m) =>
            m.status === "pending" &&
            !paidCurrentMonthMemberIds.has(m.id),
        )
        .filter((m) => {
          const next = nextBillingDateFromReminder(m.reminder_start_date, today);
          return next !== null && isDueWithinNextDays(next, today, UPCOMING_WINDOW_DAYS);
        })
        .sort((a, b) => {
          const na = nextBillingDateFromReminder(a.reminder_start_date, today)?.getTime() ?? 0;
          const nb = nextBillingDateFromReminder(b.reminder_start_date, today)?.getTime() ?? 0;
          return na - nb;
        });

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
