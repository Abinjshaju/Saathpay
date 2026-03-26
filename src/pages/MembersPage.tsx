import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import { btnPill, btnPillActive, btnPrimary } from "@/lib/buttonStyles";
import { useMembers } from "@/hooks/useMembers";
import type { PaymentStatus } from "@/data/types";

const filters: { label: string; value: PaymentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
  { label: "Pending", value: "pending" },
];

const statusColor: Record<PaymentStatus, string> = {
  paid: "bg-status-paid",
  overdue: "bg-status-overdue",
  pending: "bg-status-pending",
  failed: "bg-status-overdue",
};

const statusTextColor: Record<PaymentStatus, string> = {
  paid: "text-status-paid",
  overdue: "text-status-overdue",
  pending: "text-status-pending",
  failed: "text-status-overdue",
};

export default function MembersPage() {
  const { members, loading } = useMembers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");

  const filtered = useMemo(() => {
    let list = members;
    if (filter !== "all") list = list.filter((m) => m.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [members, search, filter]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden">
        <PageHeader
          title="Members"
          right={
            <Link
              to="/members/new"
              className={`${btnPrimary} h-11 w-11 min-h-0 shrink-0 p-0`}
              aria-label="Add member"
            >
              <span className="material-symbols-outlined text-xl">add</span>
            </Link>
          }
        />
      </div>

      {/* Desktop header */}
      <div className="hidden border-b border-border bg-surface px-8 py-5 lg:flex lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Members</h1>
          <p className="mt-1 text-sm text-ink-secondary">{members.length} total members</p>
        </div>
        <Link to="/members/new" className={`${btnPrimary} gap-2`}>
          <span className="material-symbols-outlined text-lg">add</span>
          Add member
        </Link>
      </div>

      {/* Search + filters */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-10 border-b border-border bg-bg/95 px-5 py-3 backdrop-blur-sm lg:static lg:top-auto lg:px-8 lg:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex h-10 w-full items-center overflow-hidden rounded-xl border border-border bg-elevated lg:max-w-xs">
            <span className="material-symbols-outlined px-3 text-lg text-ink-muted">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="h-full w-full border-none bg-transparent pr-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={filter === f.value ? btnPillActive : btnPill}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile list */}
      <div className="mx-5 mt-3 list-card lg:hidden">
        <div className="flex flex-col divide-y divide-border">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-ink-muted">group</span>
            <p className="text-sm font-semibold text-ink">No members found</p>
            <p className="mt-1 text-xs text-ink-muted">Try a different search or filter.</p>
          </div>
        )}
        {filtered.map((m) => (
          <Link
            key={m.id}
            to={`/members/${m.id}`}
            className="flex items-center justify-between bg-surface px-5 py-4 active:bg-bg"
          >
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor[m.status]}`} />
              <div>
                <p className="text-sm font-semibold text-ink">{m.name}</p>
                <p className={`text-xs ${m.status === "overdue" ? "font-medium text-status-overdue" : "text-ink-secondary"}`}>
                  {m.status_label ?? m.status}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-lg text-ink-muted">chevron_right</span>
          </Link>
        ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block lg:px-8 lg:py-4">
        {filtered.length === 0 ? (
          <div className="list-card flex flex-col items-center py-20 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-ink-muted">group</span>
            <p className="text-sm font-semibold text-ink">No members found</p>
            <p className="mt-1 text-xs text-ink-muted">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="list-card">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Name</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Phone</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Monthly Fee</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Status</th>
                <th className="w-10 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-bg">
                  <td className="px-5 py-4">
                    <Link to={`/members/${m.id}`} className="text-sm font-semibold text-ink hover:underline">{m.name}</Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-ink-secondary">{m.phone ?? "—"}</td>
                  <td className="px-5 py-4 text-sm font-bold tabular-nums text-ink">₹{Number(m.monthly_fee).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block text-xs font-bold uppercase tracking-wider ${statusTextColor[m.status]}`}>{m.status}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Link to={`/members/${m.id}`} className="text-ink-muted hover:text-ink">
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
