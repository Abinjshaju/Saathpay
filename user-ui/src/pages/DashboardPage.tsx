import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import GympayLogo from "@/components/branding/GympayLogo";
import { useAuth } from "@/context/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { btnPrimary } from "@/lib/buttonStyles";

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

  const { total_members, total_plans, members_by_plan, upcoming_dues } = stats;

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
          Overview of {user?.organisation?.name ?? "your organisation"}'s performance
        </p>
      </div>

      <div className="px-5 pt-4 lg:p-6">
        {/* Stat cards */}
        <div className="flex items-stretch rounded-3xl bg-elevated shadow-level1">
          <StatCell
            icon="group"
            label="Members"
            value={String(total_members)}
            iconColor="bg-primary"
          />
          <div className="my-4 w-px bg-border" />
          <StatCell
            icon="category"
            label="Plans"
            value={String(total_plans)}
            glow
          />
        </div>

        {/* Members by Plan */}
        {members_by_plan.length > 0 && (
          <div className="mt-4 rounded-3xl bg-elevated p-5 shadow-level1">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">
              Members by Plan
            </p>
            <div className="mt-4 flex items-center justify-center gap-6">
              <DonutChart segments={members_by_plan.map((p) => ({ label: p.plan, value: p.count }))} />
              <div className="flex flex-col gap-2.5">
                {members_by_plan.map((p, i) => (
                  <Legend key={p.plan} color={PLAN_COLORS[i % PLAN_COLORS.length]} label={p.plan} count={p.count} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upcoming dues */}
        <div className="pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
            Upcoming Dues
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 pb-4">
          {upcoming_dues.length === 0 && (
            <div className="flex items-center justify-center rounded-2xl bg-surface py-10 text-sm text-ink-muted shadow-level1">
              No upcoming dues
            </div>
          )}
          {upcoming_dues.map((m) => (
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
                  <p className="text-sm font-semibold text-ink">{m.full_name}</p>
                  <p className="text-xs text-ink-muted">Due: {m.next_due_date}</p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums text-ink">
                {m.plan_amount != null ? `₹${Number(m.plan_amount).toLocaleString("en-IN")}` : "—"}
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

const PLAN_COLORS = ["bg-primary", "bg-lime", "bg-status-pending", "bg-status-overdue", "bg-accent-warning"];

function StatCell({
  icon,
  label,
  value,
  iconColor = "bg-surface",
  glow = false,
}: {
  icon: string;
  label: string;
  value: string;
  iconColor?: string;
  glow?: boolean;
}) {
  const ringClass = glow ? "bg-primary/15" : iconColor;
  const iconGlyphClass = glow ? "text-primary" : iconColor === "bg-primary" ? "text-white" : "text-ink-secondary";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4 px-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full ${ringClass}`}
      >
        <span className={`material-symbols-outlined text-base ${iconGlyphClass}`}>{icon}</span>
      </span>
      <p
        title={value}
        className="min-w-0 truncate text-base font-extrabold leading-tight tabular-nums sm:text-lg text-ink"
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

function DonutChart({ segments }: { segments: { label: string; value: number }[] }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="48" fill="none" stroke="var(--color-border)" strokeWidth="14" />
      </svg>
    );
  }

  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  const colorVars = [
    "var(--color-primary)", "var(--color-lime)", "var(--color-status-pending)",
    "var(--color-status-overdue)", "var(--color-accent-warning)",
  ];

  const gap = total > 1 ? 0.01 : 0;
  const validSegs = segments.filter((s) => s.value > 0);
  const totalGap = gap * validSegs.length;
  const scale = validSegs.length > 1 ? 1 - totalGap : 1;

  let offset = 0;

  return (
    <svg ref={ref} width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      {validSegs.map((seg, i) => {
        const frac = seg.value / total;
        const segLen = frac * scale * circumference;
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
            stroke={colorVars[i % colorVars.length]}
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
