import { useState, useRef, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import GympayLogo from "@/components/branding/GympayLogo";
import { btnPrimary } from "@/lib/buttonStyles";
import { useAuth } from "@/context/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"identifier" | "password">("identifier");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  function handleIdentifierContinue(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setStep("password");
    setTimeout(() => passwordRef.current?.focus(), 50);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) return;
    setLoading(true);
    const err = await login(identifier.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  function handleBack() {
    setStep("identifier");
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
          {step === "identifier" ? "Log in to your account" : "Enter your password"}
        </h3>

        {error && (
          <p className="mt-3 rounded-lg border-l-2 border-status-overdue bg-status-overdue/5 px-4 py-2 text-sm font-medium text-status-overdue">
            {error}
          </p>
        )}

        {step === "identifier" ? (
          <form onSubmit={handleIdentifierContinue} className="mt-4">
            <div className="flex h-12 items-center overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex shrink-0 items-center gap-1.5 border-r border-border px-3">
                <span className="material-symbols-outlined text-lg text-ink-muted">person</span>
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or email"
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
              {identifier}
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

        <p className="mt-4 text-center text-[10px] text-ink-muted">
          &copy; {new Date().getFullYear()} SaathPay. Built with precision.
        </p>
      </div>
    </div>
  );
}
