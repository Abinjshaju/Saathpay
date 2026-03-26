import { useState, useRef, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import GympayLogo from "@/components/branding/GympayLogo";
import { btnPrimary, btnSecondary } from "@/lib/buttonStyles";
import { useAuth } from "@/context/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleEmailContinue(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("password");
    setTimeout(() => passwordRef.current?.focus(), 50);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) return;
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  function handleBack() {
    setStep("email");
    setPassword("");
    setError("");
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-bg px-5 pt-safe pb-safe">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center justify-center gap-2">
          <GympayLogo size="md" wordmark />
        </div>

        <h3 className="mt-4 text-center text-base font-bold tracking-tight text-ink">
          {step === "email" ? "Log in or sign up" : "Enter your password"}
        </h3>

        {error && (
          <p className="mt-3 rounded-lg border-l-2 border-status-overdue bg-status-overdue/5 px-4 py-2 text-sm font-medium text-status-overdue">
            {error}
          </p>
        )}

        {step === "email" ? (
          <form onSubmit={handleEmailContinue} className="mt-4">
            <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex shrink-0 items-center gap-1.5 border-r border-border px-3">
                <span className="material-symbols-outlined text-lg text-ink-muted">mail</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="h-full min-w-0 flex-1 border-none bg-transparent px-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
                autoFocus
              />
            </div>

            <button type="submit" className={`${btnPrimary} mt-4 w-full`}>
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="mt-4">
            <button
              type="button"
              onClick={handleBack}
              className="mb-3 flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {email}
            </button>

            <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex shrink-0 items-center gap-1.5 border-r border-border px-3">
                <span className="material-symbols-outlined text-lg text-ink-muted">lock</span>
              </div>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-full min-w-0 flex-1 border-none bg-transparent px-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
              />
            </div>

            <button type="submit" disabled={loading} className={`${btnPrimary} mt-4 w-full`}>
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Link to="/register" className={`${btnSecondary} mt-4 w-full`}>
          Create a new account
        </Link>

        <p className="mt-4 text-center text-[10px] text-ink-muted">
          &copy; {new Date().getFullYear()} Gympay. Built with precision.
        </p>
      </div>
    </div>
  );
}
