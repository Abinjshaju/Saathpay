import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import GympayLogo from "@/components/branding/GympayLogo";
import { useAuth } from "@/context/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { btnPrimary } from "@/lib/buttonStyles";

const CURRENT_MONTH = new Date().toLocaleString("default", { month: "long", year: "numeric" });

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, loading } = useDashboardStats();

  if (loading || !stats) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="loading-spinner" />
      </div>
    );
  }

  const {
    totalMembers, paymentReceived, failedCount,
    paidCount, overdueCount, pendingCount,
    upcoming,
  } = stats;

  return (
    <>
      {/* Header — only on mobile */}
      <div className="sticky top-0 z-10 bg-bg px-5 pt-safe pb-3 lg:hidden">
        <GympayLogo size="sm" />
      </div>

      {/* Desktop header */}
      <div className="hidden border-b border-border bg-surface px-8 py-5 lg:block">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Overview of {user?.business_name ?? "your gym"}'s performance
        </p>
      </div>

      <div className="px-5 pt-4 lg:p-6">
        {/* Stat cards with current month title */}
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
          {CURRENT_MONTH}
        </p>
        <div className="flex items-stretch rounded-3xl bg-elevated shadow-level1">
          <StatCell
            icon="group"
            label="Members"
            value={String(totalMembers)}
            iconColor="bg-primary"
          />
          <div className="my-4 w-px bg-border" />
          <StatCell
            icon="account_balance_wallet"
            label="Received"
            value={`₹${paymentReceived.toLocaleString("en-IN")}`}
            glow
          />
          <div className="my-4 w-px bg-border" />
          <StatCell
            icon="error_outline"
            label="Failed"
            value={String(failedCount)}
            danger
          />
        </div>

        {/* Member Status — full-width donut chart */}
        <div className="mt-4 rounded-3xl bg-elevated p-5 shadow-level1">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">
            Member Status
          </p>
          <div className="mt-4 flex items-center justify-center gap-6">
            <DonutChart paid={paidCount} overdue={overdueCount} pending={pendingCount} />
            <div className="flex flex-col gap-2.5">
              <Legend color="bg-lime" label="Paid" count={paidCount} />
              <Legend color="bg-status-overdue" label="Overdue" count={overdueCount} />
              <Legend color="bg-status-pending" label="Pending" count={pendingCount} />
            </div>
          </div>
        </div>

        {/* Upcoming payments */}
        <div className="pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
            Upcoming Payments
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 pb-4">
          {upcoming.length === 0 && (
            <div className="flex items-center justify-center rounded-2xl bg-surface py-10 text-sm text-ink-muted shadow-level1">
              No upcoming payments
            </div>
          )}
          {upcoming.map((m) => (
            <Link
              key={m.id}
              to={`/members/${m.id}`}
              className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-level1 transition-all duration-200 ease-out hover:bg-elevated active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated">
                  <span className="material-symbols-outlined text-lg text-ink-secondary">
                    calendar_month
                  </span>
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{m.name}</p>
                  <p className="text-xs text-ink-muted">{m.status_label ?? "Pending"}</p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums text-ink">
                ₹{Number(m.monthly_fee).toLocaleString("en-IN")}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Primary action — mobile only; sits above bottom nav + home indicator */}
      <div className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+0.75rem)] left-0 right-0 z-10 flex justify-end px-4 lg:hidden">
        <Link to="/members/new" className={`${btnPrimary} pointer-events-auto`}>
          <span className="material-symbols-outlined text-xl">add</span>
          Add member
        </Link>
      </div>
    </>
  );
}

function StatCell({
  icon,
  label,
  value,
  iconColor = "bg-surface",
  glow = false,
  danger = false,
}: {
  icon: string;
  label: string;
  value: string;
  iconColor?: string;
  glow?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4 px-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full ${iconColor}`}
      >
        <span className="material-symbols-outlined text-base text-white">{icon}</span>
      </span>
      <p
        title={value}
        className={`min-w-0 truncate text-base font-extrabold leading-tight tabular-nums sm:text-lg ${
          danger ? "text-status-overdue" : "text-ink"
        }`}
        style={glow ? { textShadow: "0 0 12px rgba(46,107,255,0.35)" } : undefined}
      >
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
    </div>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      <span className="text-xs font-medium text-ink-secondary">{label}</span>
      <span className="ml-auto text-xs font-bold tabular-nums text-ink">{count}</span>
    </div>
  );
}

function DonutChart({ paid, overdue, pending }: { paid: number; overdue: number; pending: number }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const total = paid + overdue + pending;
  if (total === 0) {
    return (
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="48" fill="none" stroke="var(--color-border)" strokeWidth="14" />
      </svg>
    );
  }

  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  const paidFrac = paid / total;
  const overdueFrac = overdue / total;
  const pendingFrac = pending / total;

  const gap = total > 1 ? 0.01 : 0;
  const segments = [
    { frac: paidFrac, color: "var(--color-lime)" },
    { frac: overdueFrac, color: "var(--color-status-overdue)" },
    { frac: pendingFrac, color: "var(--color-status-pending)" },
  ].filter((s) => s.frac > 0);

  const totalGap = gap * segments.length;
  const scale = segments.length > 1 ? 1 - totalGap : 1;

  let offset = 0;

  return (
    <svg ref={ref} width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      {segments.map((seg, i) => {
        const segLen = seg.frac * scale * circumference;
        const dashArray = `${animated ? segLen : 0} ${circumference}`;
        const dashOffset = -offset;
        offset += segLen + gap * circumference;
        return (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
            style={{
              transition: "stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              transitionDelay: `${i * 150}ms`,
            }}
          />
        );
      })}
      <text
        x="60"
        y="56"
        textAnchor="middle"
        className="fill-ink text-lg font-extrabold"
        style={{ fontSize: 22, fontWeight: 800 }}
      >
        {total}
      </text>
      <text
        x="60"
        y="72"
        textAnchor="middle"
        className="fill-ink-muted"
        style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}
      >
        Total
      </text>
    </svg>
  );
}
