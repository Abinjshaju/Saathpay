import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { btnPrimary } from "@/lib/buttonStyles";

const BUSINESS_TYPES = [
  { value: "gym", label: "Gym" },
  { value: "yoga", label: "Yoga" },
  { value: "dance", label: "Dance" },
] as const;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("gym");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const err = await register(email, password, businessName, phone, businessType);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  const inputClass =
    "h-12 w-full rounded-lg border border-border bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:ring-0";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="pt-safe">
        <div className="flex h-14 items-center px-5">
          <Link to="/" className="text-ink hover:text-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pt-8 pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Get started</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Create account</h1>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
          {error && (
            <p className="border-l-2 border-status-overdue bg-status-overdue/5 px-4 py-2 text-sm font-medium text-status-overdue">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Business Name</span>
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="My Gym" className={inputClass} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Type of Business</span>
            <div className="flex gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => setBusinessType(bt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ease-out ${
                    businessType === bt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-ink-secondary hover:border-ink-muted"
                  }`}
                >
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Phone Number</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Confirm Password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={inputClass} />
          </label>

          <button type="submit" disabled={loading} className={`${btnPrimary} mt-2 w-full`}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-secondary">
          Already have an account?{" "}
          <Link to="/" className="font-semibold text-ink underline">Log in</Link>
        </p>
      </main>
    </div>
  );
}
