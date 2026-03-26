import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import { useAllPayments } from "@/hooks/usePayments";
import { useMembers } from "@/hooks/useMembers";

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-status-paid/10", text: "text-status-paid", label: "Paid" },
  failed: { bg: "bg-status-overdue/10", text: "text-status-overdue", label: "Failed" },
  overdue: { bg: "bg-status-overdue/10", text: "text-status-overdue", label: "Overdue" },
  pending: { bg: "bg-status-pending/10", text: "text-status-pending", label: "Pending" },
};

interface GroupedMonth {
  key: string;
  label: string;
  total: number;
  items: {
    id: string;
    memberId: string;
    memberName: string;
    date: string;
    amount: number;
    status: string;
  }[];
}

export default function PaymentHistoryPage() {
  const { payments, loading: pLoading } = useAllPayments();
  const { members, loading: mLoading } = useMembers();

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  );

  const grouped: GroupedMonth[] = useMemo(() => {
    const map = new Map<string, GroupedMonth>();

    for (const p of payments) {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });

      if (!map.has(key)) map.set(key, { key, label, total: 0, items: [] });
      const grp = map.get(key)!;
      grp.items.push({
        id: p.id,
        memberId: p.member_id,
        memberName: memberMap.get(p.member_id) ?? "Unknown",
        date: p.date,
        amount: Number(p.amount),
        status: p.status,
      });
      if (p.status === "paid") grp.total += Number(p.amount);
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [payments, memberMap]);

  if (pLoading || mLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title="Payment History" showBack />

      <div className="px-5 pt-4 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-6 lg:py-6">
        {grouped.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-ink-muted">receipt_long</span>
            <p className="text-sm text-ink-muted">No transactions yet</p>
          </div>
        )}

        {grouped.map((g) => (
          <section key={g.key} className="mb-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
                {g.label}
              </h2>
              <p className="text-xs font-bold tabular-nums text-status-paid">
                ₹{g.total.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="mt-3 list-card">
              <div className="flex flex-col divide-y divide-border">
                {g.items.map((item) => {
                  const badge = statusBadge[item.status] ?? statusBadge.pending;
                  return (
                    <Link
                      key={item.id}
                      to={`/members/${item.memberId}`}
                      className="flex items-center justify-between px-4 py-3.5 transition-colors duration-200 hover:bg-elevated"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated">
                          <span className="material-symbols-outlined text-lg text-ink-secondary">
                            {item.status === "paid" ? "check_circle" : "schedule"}
                          </span>
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{item.memberName}</p>
                          <p className="text-[11px] text-ink-muted">{item.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold tabular-nums text-ink">
                          ₹{item.amount.toLocaleString("en-IN")}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
