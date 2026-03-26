import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { btnPrimary, btnSecondary } from "@/lib/buttonStyles";
import { supabase } from "@/lib/supabase";

export default function AddMemberPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    supabase.from("members").select("*").eq("id", id).single()
      .then(({ data }) => {
        if (data) {
          setName(data.name);
          setPhone(data.phone ?? "");
          setFee(String(data.monthly_fee));
        }
        setLoadingEdit(false);
      });
  }, [id]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    if (isEdit) {
      await supabase.from("members").update({
        name: name.trim(),
        phone: phone.trim() || null,
        monthly_fee: parseFloat(fee) || 0,
      }).eq("id", id);
    } else {
      await supabase.from("members").insert({
        name: name.trim(),
        phone: phone.trim() || null,
        monthly_fee: parseFloat(fee) || 0,
        status: "pending",
        status_label: "New member",
      });
    }

    navigate("/members", { replace: true });
  }

  const inputClass =
    "h-12 w-full rounded-lg border border-border bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:ring-0";

  if (loadingEdit) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="loading-spinner" />
      </div>
    );
  }

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
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Jane Doe" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Phone Number</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(123) 456-7890" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Monthly Fee</span>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <span className="text-sm font-medium text-ink-muted">₹</span>
              </div>
              <input type="number" inputMode="decimal" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="500" className={`${inputClass} pl-8`} />
            </div>
          </label>

          {!isEdit && (
            <button
              type="button"
              className={`${btnSecondary} mt-2 w-full border-primary/50 text-primary hover:bg-primary/5`}
            >
              <span className="material-symbols-outlined text-lg">send</span>
              Send autopay link
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`${btnPrimary} w-full`}
          >
            {saving ? "Saving..." : isEdit ? "Update member" : "Save member"}
          </button>
        </form>
      </main>
    </div>
  );
}
