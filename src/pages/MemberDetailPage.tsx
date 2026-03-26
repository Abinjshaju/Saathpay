import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { btnDangerOutline, btnPrimary, btnSecondary } from "@/lib/buttonStyles";
import { useMember } from "@/hooks/useMembers";
import { usePayments } from "@/hooks/usePayments";
import { supabase } from "@/lib/supabase";

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-status-paid/10", text: "text-status-paid", label: "Paid" },
  failed: { bg: "bg-status-overdue/10", text: "text-status-overdue", label: "Failed" },
  overdue: { bg: "bg-status-overdue/10", text: "text-status-overdue", label: "Overdue" },
  pending: { bg: "bg-status-pending/10", text: "text-status-pending", label: "Pending" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generateMonthOptions() {
  const now = new Date();
  const options: string[] = [];
  for (let offset = -6; offset <= 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    options.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
  }
  return options;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, loading: memberLoading } = useMember(id);
  const { payments, loading: paymentsLoading, fetchPayments } = usePayments(id);
  const [showDelete, setShowDelete] = useState(false);

  // Mark existing unpaid payment
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markAmount, setMarkAmount] = useState("");

  // Record new payment (one or more months)
  const [showRecord, setShowRecord] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [recordAmount, setRecordAmount] = useState("");

  const [saving, setSaving] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const paidMonths = useMemo(() => new Set(payments.filter((p) => p.status === "paid").map((p) => p.month)), [payments]);

  async function updateMemberStatusFromPayments(
    justInserted?: { status: string }[],
  ) {
    const now = new Date();
    const currentMonth = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

    const allPayments = justInserted
      ? [...payments, ...(justInserted as typeof payments)]
      : payments;

    const currentMonthPayments = allPayments.filter((p) => p.month === currentMonth);
    const hasPaidCurrent = currentMonthPayments.some((p) => p.status === "paid");

    if (justInserted) {
      const anyPaid = justInserted.some((r) => r.status === "paid");
      if (anyPaid || hasPaidCurrent) {
        await supabase
          .from("members")
          .update({ status: "paid", status_label: `Paid for ${currentMonth}` })
          .eq("id", id);
        return;
      }
    }

    if (hasPaidCurrent) {
      await supabase
        .from("members")
        .update({ status: "paid", status_label: `Paid for ${currentMonth}` })
        .eq("id", id);
    } else {
      const { data: freshPayments } = await supabase
        .from("payments")
        .select("status, month")
        .eq("member_id", id!);
      const paid = (freshPayments ?? []).some(
        (p) => p.month === currentMonth && p.status === "paid",
      );
      if (paid) {
        await supabase
          .from("members")
          .update({ status: "paid", status_label: `Paid for ${currentMonth}` })
          .eq("id", id);
      }
    }
  }

  if (memberLoading || paymentsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-1 flex-col bg-bg">
        <PageHeader title="Not Found" showBack />
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-ink-muted">
          Member not found.
        </div>
      </div>
    );
  }

  async function handleDelete() {
    await supabase.from("members").delete().eq("id", id);
    setShowDelete(false);
    navigate("/members", { replace: true });
  }

  async function handleMarkPaid() {
    if (!markingId || !markAmount) return;
    setSaving(true);
    const today = new Date();
    const dateStr = `Paid on ${MONTH_NAMES[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    await supabase.from("payments").update({
      status: "paid",
      amount: parseFloat(markAmount),
      date: dateStr,
    }).eq("id", markingId);
    await updateMemberStatusFromPayments();
    setMarkingId(null);
    setMarkAmount("");
    setSaving(false);
    await fetchPayments();
  }

  function toggleMonth(month: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  async function handleRecordPayment() {
    if (selectedMonths.size === 0 || !recordAmount) return;
    setSaving(true);
    const today = new Date();
    const dateStr = `Paid on ${MONTH_NAMES[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const feePerMonth = Number(member!.monthly_fee);
    let remaining = parseFloat(recordAmount);

    // Sort selected months chronologically so dues are closed oldest-first
    const sorted = Array.from(selectedMonths).sort((a, b) => {
      const [mA, yA] = a.split(" ");
      const [mB, yB] = b.split(" ");
      const dA = new Date(Number(yA), MONTH_NAMES.indexOf(mA));
      const dB = new Date(Number(yB), MONTH_NAMES.indexOf(mB));
      return dA.getTime() - dB.getTime();
    });

    const rows: { member_id: string | undefined; month: string; date: string; amount: number; status: "paid" | "pending" }[] = [];

    for (const month of sorted) {
      if (remaining <= 0) {
        rows.push({ member_id: id, month, date: dateStr, amount: 0, status: "pending" });
        continue;
      }
      const allocated = Math.min(remaining, feePerMonth);
      remaining = Math.round((remaining - allocated) * 100) / 100;
      rows.push({
        member_id: id,
        month,
        date: dateStr,
        amount: Math.round(allocated * 100) / 100,
        status: allocated >= feePerMonth ? "paid" : "pending",
      });
    }

    await supabase.from("payments").insert(rows);
    await updateMemberStatusFromPayments(rows);
    setShowRecord(false);
    setSelectedMonths(new Set());
    setRecordAmount("");
    setSaving(false);
    await fetchPayments();
  }

  function openRecordForm() {
    setShowRecord(true);
    setSelectedMonths(new Set());
    setRecordAmount(String(Number(member!.monthly_fee)));
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title={member.name} showBack />

      <div className="space-y-4 px-5 pt-4 lg:mx-auto lg:w-full lg:max-w-2xl lg:space-y-6 lg:px-6 lg:py-6">
        {/* Info */}
        <div className="list-card px-5 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Phone</p>
              <p className="mt-1 text-sm font-medium text-ink">{member.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Monthly Fee</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-ink">₹{Number(member.monthly_fee).toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <Link to={`/members/${member.id}/edit`} className={`${btnSecondary} shrink-0 px-3`}>
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </Link>
            <button type="button" onClick={openRecordForm} className={`${btnPrimary} min-w-0 flex-1`}>
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                payments
              </span>
              Record payment
            </button>
          </div>
        </div>

        {/* Record payment form */}
        {showRecord && (
          <div className="list-card px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
              Select Months
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {monthOptions.map((month) => {
                const alreadyPaid = paidMonths.has(month);
                const selected = selectedMonths.has(month);
                return (
                  <button
                    key={month}
                    disabled={alreadyPaid}
                    onClick={() => toggleMonth(month)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out ${
                      alreadyPaid
                        ? "cursor-not-allowed border-border text-ink-muted/40 line-through"
                        : selected
                          ? "border-lime bg-lime text-[#0B0F14] shadow-glow-lime"
                          : "border-border bg-elevated text-ink-secondary hover:border-ink-muted hover:text-ink"
                    }`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>

            {selectedMonths.size > 0 && (
              <>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
                  Total Amount{selectedMonths.size > 1 ? ` (${selectedMonths.size} months)` : ""}
                </p>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="text-sm font-medium text-ink-muted">₹</span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-surface pl-8 pr-4 text-base tabular-nums text-ink focus:border-ink focus:ring-0"
                  />
                </div>
                {selectedMonths.size > 1 && recordAmount && (() => {
                  const feePerMonth = Number(member!.monthly_fee);
                  let rem = parseFloat(recordAmount);
                  const sorted = Array.from(selectedMonths).sort((a, b) => {
                    const [mA, yA] = a.split(" ");
                    const [mB, yB] = b.split(" ");
                    return new Date(Number(yA), MONTH_NAMES.indexOf(mA)).getTime() -
                           new Date(Number(yB), MONTH_NAMES.indexOf(mB)).getTime();
                  });
                  return (
                    <div className="mt-2 space-y-0.5">
                      {sorted.map((mo) => {
                        const alloc = Math.min(Math.max(rem, 0), feePerMonth);
                        rem = Math.round((rem - alloc) * 100) / 100;
                        return (
                          <p key={mo} className="flex justify-between text-[10px] text-ink-muted">
                            <span>{mo}</span>
                            <span className={alloc >= feePerMonth ? "text-status-paid" : alloc > 0 ? "text-status-pending" : "text-ink-muted"}>
                              ₹{alloc.toLocaleString("en-IN")} {alloc >= feePerMonth ? "✓" : alloc > 0 ? "(partial)" : "—"}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowRecord(false); setSelectedMonths(new Set()); setRecordAmount(""); }}
                className={`${btnSecondary} flex-1`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={saving || selectedMonths.size === 0 || !recordAmount}
                className={`${btnPrimary} flex-1`}
              >
                {saving ? "Saving..." : "Confirm payment"}
              </button>
            </div>
          </div>
        )}

        {/* Payment history */}
        <div className="pt-2 lg:px-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
            Payment History
          </p>
        </div>

        <div className="mt-3 list-card">
          <div className="flex flex-col divide-y divide-border">
          {payments.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="material-symbols-outlined mb-2 text-3xl text-ink-muted">receipt_long</span>
              <p className="text-sm text-ink-muted">No payment records yet</p>
              <p className="mt-1 text-xs text-ink-muted">Use "Record Payment" above to add one.</p>
            </div>
          )}
          {payments.map((p) => {
            const badge = statusBadge[p.status] ?? statusBadge.pending;
            const isUnpaid = p.status !== "paid";
            const isBeingMarked = markingId === p.id;

            return (
              <div key={p.id}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{p.month}</p>
                    <p className="text-xs text-ink-secondary">{p.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold tabular-nums text-ink">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {isUnpaid && !isBeingMarked && (
                  <div className="border-t border-border/50 px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => { setMarkingId(p.id); setMarkAmount(String(Number(p.amount))); }}
                      className={`${btnPrimary} w-full`}
                    >
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      Mark as paid
                    </button>
                  </div>
                )}

                {isBeingMarked && (
                  <div className="border-t border-border/50 px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Amount Paid</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <div className="relative min-w-0 flex-1 basis-[8rem]">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-xs font-medium text-ink-muted">₹</span>
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={markAmount}
                          onChange={(e) => setMarkAmount(e.target.value)}
                          className="h-11 w-full rounded-lg border border-border bg-surface pl-7 pr-3 text-base tabular-nums text-ink focus:border-ink focus:ring-0"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setMarkingId(null); setMarkAmount(""); }}
                        className={`${btnSecondary} shrink-0 px-4`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleMarkPaid}
                        disabled={saving || !markAmount}
                        className={`${btnPrimary} shrink-0`}
                      >
                        {saving ? "..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>

        <div className="pb-5 pt-2 lg:px-0">
          <button type="button" onClick={() => setShowDelete(true)} className={btnDangerOutline}>
            <span className="material-symbols-outlined text-[20px]">delete</span>
            Delete member
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Member"
        message={`Are you sure you want to delete ${member.name}? This action cannot be undone and all payment history will be lost.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
