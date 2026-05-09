import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { btnDangerOutline, btnPrimary, btnSecondary } from "@/lib/buttonStyles";
import { useMember, useMembers } from "@/hooks/useMembers";
import { usePayments } from "@/hooks/usePayments";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/utils/supabase";
import { sendTwilioMessage } from "@/lib/twilio";

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-status-paid/10", text: "text-status-paid", label: "Paid" },
  failed: { bg: "bg-status-overdue/10", text: "text-status-overdue", label: "Failed" },
  overdue: { bg: "bg-status-overdue/10", text: "text-status-overdue", label: "Overdue" },
  pending: { bg: "bg-status-pending/10", text: "text-status-pending", label: "Pending" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, loading: memberLoading } = useMember(id);
  const { payments, loading: paymentsLoading, fetchPayments } = usePayments(id);
  const { updateMember } = useMembers();
  const { profile } = useUserProfile();
  
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markAmount, setMarkAmount] = useState("");
  
  const [nextDueDate, setNextDueDate] = useState("");
  const [sendingReminder, setSendingReminder] = useState<"whatsapp" | "sms" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (member?.next_due_date) {
      setNextDueDate(member.next_due_date);
    }
  }, [member]);

  const handleUpdateDueDate = async (date: string) => {
    setNextDueDate(date);
    if (id) {
      await updateMember(id, { next_due_date: date });
    }
  };

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
    
    // Update member status
    const currentMonth = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
    await supabase.from("members").update({ 
      status: "paid", 
      // status_label: `Paid for ${currentMonth}` // Missing in DB
    }).eq("id", id);

    setMarkingId(null);
    setMarkAmount("");
    setSaving(false);
    await fetchPayments();
  }

  async function handleDelete() {
    await supabase.from("members").delete().eq("id", id);
    setShowDelete(false);
    navigate("/members", { replace: true });
  }

  const handleSendReminder = async (channel: "whatsapp" | "sms") => {
    if (!member || !profile) return;
    if (!member.phone) {
      setToast({ message: "Member phone number missing", type: "error" });
      return;
    }
    if (!nextDueDate) {
      setToast({ message: "Please set a due date first", type: "error" });
      return;
    }

    setSendingReminder(channel);
    try {
      const businessName = profile.business_name || "SaathPay";
      const amount = Number(member.monthly_fee).toLocaleString("en-IN");
      const formattedDate = new Date(nextDueDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const body = `SaathPay Reminder: 

Dear ${member.name}, 
This is a friendly reminder from ${businessName}. Your monthly fee of ₹${amount} is due on ${formattedDate}.

Please ensure payment is made by the due date. If you have already paid, please ignore this message.

Regards,
${businessName}`;

      await sendTwilioMessage({
        to: member.phone,
        body,
        channel,
      });

      setToast({ message: `Reminder sent via ${channel === "whatsapp" ? "WhatsApp" : "SMS"}!`, type: "success" });
    } catch (error: any) {
      console.error(error);
      setToast({ message: error.message || "Failed to send reminder", type: "error" });
    } finally {
      setSendingReminder(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

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

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title={member.name} showBack />

      <div className="space-y-4 px-5 pt-4 lg:mx-auto lg:w-full lg:max-w-2xl lg:space-y-6 lg:px-6 lg:py-6">
        {/* Info Card */}
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
            <div className="col-span-2 mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Next Due Date</p>
              <input 
                type="date" 
                value={nextDueDate}
                onChange={(e) => handleUpdateDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:ring-0"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex gap-3">
              <button 
                onClick={() => handleSendReminder("whatsapp")}
                disabled={true}
                className={`${btnPrimary} flex-1 bg-gray-400 cursor-not-allowed border-none text-white opacity-50`}
                title="WhatsApp reminders are currently unavailable"
              >
                <span className="material-symbols-outlined text-[22px]">chat</span>
                WhatsApp Reminder
              </button>
              <button 
                onClick={() => handleSendReminder("sms")}
                disabled={!!sendingReminder}
                className={`${btnPrimary} flex-1`}
              >
                <span className="material-symbols-outlined text-[22px]">sms</span>
                {sendingReminder === "sms" ? "Sending..." : "SMS Reminder"}
              </button>
            </div>
            
            <Link to={`/members/${member.id}/edit`} className={`${btnSecondary} w-full justify-center`}>
              <span className="material-symbols-outlined text-[20px]">edit</span>
              Edit Details
            </Link>
          </div>
        </div>

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

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-30 flex w-11/12 max-w-sm -translate-x-1/2 items-center gap-3 border-l-4 ${toast.type === "success" ? "border-status-paid" : "border-status-overdue"} bg-ink px-4 py-3 text-white`}>
          <span className="material-symbols-outlined text-lg">{toast.type === "success" ? "check_circle" : "error"}</span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)}>
            <span className="material-symbols-outlined text-lg text-white/60 hover:text-white">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
