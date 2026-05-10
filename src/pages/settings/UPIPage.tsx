import { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { btnPrimary } from "@/lib/buttonStyles";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function UPIPage() {
  const { profile, updateProfile } = useUserProfile();
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setUpiId(profile.upi_id ?? "");
      setPayeeName(profile.upi_payee_name ?? profile.business_name ?? "");
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    const err = await updateProfile({ 
      upi_id: upiId, 
      upi_payee_name: payeeName 
    });
    setSaving(false);
    if (!err) {
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    }
  }

  const inputClass =
    "h-12 w-full min-w-0 flex-1 border-none bg-transparent px-4 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0";

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <PageHeader title="UPI Configuration" showBack />

      <div className="lg:mx-auto lg:w-full lg:max-w-lg lg:py-6">
        <div className="flex flex-col items-center px-5 pt-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
          </div>
        </div>

        <div className="px-5 pt-5 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">UPI Payment Info</h2>
          <p className="mt-2 text-sm text-ink-secondary">Direct UPI payments to your bank account.</p>
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-6 px-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">UPI ID</span>
            <div className="flex overflow-hidden rounded-lg border border-border bg-surface">
              <input 
                value={upiId} 
                onChange={(e) => setUpiId(e.target.value)} 
                placeholder="example@upi" 
                className={inputClass} 
              />
              <div className="flex items-center border-l border-border px-3 text-ink-muted">
                <span className="material-symbols-outlined text-lg">payments</span>
              </div>
            </div>
            <p className="text-[10px] text-ink-muted px-1">This will be used to generate payment links in reminders.</p>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Payee Name</span>
            <div className="flex overflow-hidden rounded-lg border border-border bg-surface">
              <input 
                value={payeeName} 
                onChange={(e) => setPayeeName(e.target.value)} 
                placeholder="Your Name or Business Name" 
                className={inputClass} 
              />
              <div className="flex items-center border-l border-border px-3 text-ink-muted">
                <span className="material-symbols-outlined text-lg">person</span>
              </div>
            </div>
          </label>

          <button type="button" onClick={handleSave} disabled={saving} className={`${btnPrimary} mt-2 w-full`}>
            {saving ? "Saving..." : "Save UPI Settings"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-30 flex w-11/12 max-w-sm -translate-x-1/2 items-center gap-3 border-l-4 border-status-paid bg-ink px-4 py-3 text-white">
          <span className="material-symbols-outlined text-lg text-status-paid">check_circle</span>
          <p className="flex-1 text-sm font-medium">UPI settings saved successfully.</p>
          <button onClick={() => setToast(false)}>
            <span className="material-symbols-outlined text-lg text-white/60 hover:text-white">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
