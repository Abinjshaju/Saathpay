import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { btnPrimary } from "@/lib/buttonStyles";
import { api } from "@/lib/api";
import { usePlans } from "@/hooks/usePlans";
import type { Member } from "@/data/types";

export default function AddMemberPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { plans, loading: plansLoading } = usePlans();

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    api.get<Member>(`/user/members/${id}`)
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name);
          setMobile(data.mobile ?? "");
          setEmail(data.email ?? "");
          setPlanId(data.plan_id ?? "");
          setJoinDate(data.join_date ? String(data.join_date).slice(0, 10) : "");
        }
        setLoadingEdit(false);
      });
  }, [id]);

  // Auto-select first plan when plans load and no plan is selected
  useEffect(() => {
    if (!planId && plans.length > 0 && !isEdit) {
      setPlanId(plans[0].id);
    }
  }, [plans, planId, isEdit]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!fullName.trim() || !planId) return;
    setSaving(true);

    const payload = {
      full_name: fullName.trim(),
      mobile: mobile.trim() || "",
      email: email.trim() || null,
      plan_id: planId,
      join_date: joinDate.trim() || null,
    };

    if (isEdit) {
      await api.put(`/user/members/${id}`, payload);
    } else {
      await api.post("/user/members", payload);
    }

    navigate("/members", { replace: true });
  }

  const inputClass =
    "h-12 w-full rounded-lg border border-border bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:ring-0";

  if (loadingEdit || plansLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="loading-spinner" />
      </div>
    );
  }

  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 pt-safe backdrop-blur-sm">
        <div className="flex h-14 items-center px-5">
          <button onClick={() => navigate(-1)} className="text-ink hover:text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
          <h1 className="flex-1 pr-6 text-center text-base font-bold tracking-tight text-ink">
            {isEdit ? "Edit Member" : "Add New Member"}
          </h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-5 pb-10 pt-6 lg:mx-auto lg:w-full lg:max-w-lg lg:pb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Full Name</span>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., Jane Doe" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Mobile Number</span>
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Plan</span>
            {plans.length === 0 ? (
              <p className="text-sm text-ink-muted">No plans available. Ask admin to create plans.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-200 ease-out ${
                      planId === p.id
                        ? "border-primary bg-primary/10 shadow-glow-blue"
                        : "border-border bg-surface hover:border-ink-muted"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${planId === p.id ? "text-primary" : "text-ink"}`}>{p.name}</p>
                      <p className="text-xs text-ink-muted">{p.billing_cycle}</p>
                    </div>
                    <p className={`text-base font-bold tabular-nums ${planId === p.id ? "text-primary" : "text-ink"}`}>
                      ₹{Number(p.amount).toLocaleString("en-IN")}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Join Date</span>
            <span className="text-[11px] text-ink-muted">Optional. When the member joined.</span>
            <input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
              className={inputClass}
            />
          </label>

          {selectedPlan && (
            <div className="rounded-xl border border-border bg-elevated/50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Selected Plan Summary</p>
              <p className="mt-1 text-sm text-ink">
                <span className="font-semibold">{selectedPlan.name}</span> — ₹{Number(selectedPlan.amount).toLocaleString("en-IN")} / {selectedPlan.billing_cycle}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !planId}
            className={`${btnPrimary} w-full`}
          >
            {saving ? "Saving..." : isEdit ? "Update member" : "Save member"}
          </button>
        </form>
      </main>
    </div>
  );
}
