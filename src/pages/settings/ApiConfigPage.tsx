import { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { btnPrimary } from "@/lib/buttonStyles";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function ApiConfigPage() {
  const { profile, updateProfile } = useUserProfile();
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setApiKey(profile.api_key ?? "");
      setSecretKey(profile.secret_key ?? "");
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    const err = await updateProfile({ api_key: apiKey, secret_key: secretKey });
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
      <PageHeader title="API Configuration" showBack />

      <div className="lg:mx-auto lg:w-full lg:max-w-lg lg:py-6">
        <div className="flex flex-col items-center px-5 pt-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-3xl">shield_lock</span>
          </div>
        </div>

        <div className="px-5 pt-5 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Payment Gateway</h2>
          <p className="mt-2 text-sm text-ink-secondary">Connect your payment provider with API credentials.</p>
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-6 px-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">API Key</span>
            <div className="flex overflow-hidden rounded-lg border border-border bg-surface">
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="pk_live_..." className={inputClass} />
              <div className="flex items-center border-l border-border px-3 text-ink-muted">
                <span className="material-symbols-outlined text-lg">key</span>
              </div>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Secret Key</span>
            <div className="flex overflow-hidden rounded-lg border border-border bg-surface">
              <input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} type={showSecret ? "text" : "password"} placeholder="sk_live_..." className={inputClass} />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="flex items-center border-l border-border px-3 text-ink-muted transition-colors hover:text-ink">
                <span className="material-symbols-outlined text-lg">{showSecret ? "visibility" : "visibility_off"}</span>
              </button>
            </div>
          </label>

          <button type="button" onClick={handleSave} disabled={saving} className={`${btnPrimary} mt-2 w-full`}>
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-30 flex w-11/12 max-w-sm -translate-x-1/2 items-center gap-3 border-l-4 border-status-paid bg-ink px-4 py-3 text-white">
          <span className="material-symbols-outlined text-lg text-status-paid">check_circle</span>
          <p className="flex-1 text-sm font-medium">API settings saved successfully.</p>
          <button onClick={() => setToast(false)}>
            <span className="material-symbols-outlined text-lg text-white/60 hover:text-white">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
