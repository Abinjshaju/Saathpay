import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GympayLogo from "@/components/branding/GympayLogo";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import PageHeader from "@/components/layout/PageHeader";

const menuItems = [
  { to: "/settings/api", icon: "key", label: "API Configuration", desc: "Payment gateway credentials" },
  { to: "/settings/export", icon: "download", label: "Export Data", desc: "Download payment records" },
  { to: "/settings/account", icon: "person", label: "Account", desc: "Profile and preferences" },
];

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [showLogout, setShowLogout] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <>
      <div className="lg:hidden">
        <PageHeader title="Settings" />
      </div>

      <div className="hidden border-b border-border bg-surface px-8 py-5 lg:block">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-secondary">Manage your account and preferences</p>
      </div>

      <div className="pt-4 lg:p-8">
        <div className="lg:grid lg:max-w-4xl lg:grid-cols-[280px_1fr] lg:gap-8">
          <div className="mx-5 rounded-3xl bg-elevated px-5 py-5 shadow-level1 lg:mx-0 lg:self-start">
            <div className="flex items-center gap-4">
              <GympayLogo size="lg" />
              <div>
                <p className="text-sm font-bold text-ink">{user?.business_name ?? "My Gym"}</p>
                <p className="text-xs text-ink-muted">{user?.email ?? ""}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="px-5 pt-6 lg:px-0 lg:pt-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">General</p>
            </div>

            <div className="mx-5 mt-3 list-card lg:mx-0">
              <div className="flex flex-col divide-y divide-border">
              {menuItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-bg active:bg-bg"
                >
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-xl text-ink-muted">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                      <p className="text-xs text-ink-secondary">{item.desc}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-lg text-ink-muted">chevron_right</span>
                </button>
              ))}
              </div>
            </div>

            <div className="px-5 pt-6 lg:px-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Appearance</p>
            </div>

            <div className="mx-5 mt-3 list-card lg:mx-0">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-bg active:bg-bg"
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-xl text-ink-muted">
                    {isDark ? "dark_mode" : "light_mode"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Theme</p>
                    <p className="text-xs text-ink-secondary">{isDark ? "Dark" : "Light"}</p>
                  </div>
                </div>

                <div
                  className={`relative h-[30px] w-[52px] rounded-full transition-all duration-200 ease-out ${
                    isDark ? "bg-primary shadow-glow-blue" : "bg-ink-muted/30"
                  }`}
                >
                  <div
                    className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      isDark ? "translate-x-[25px]" : "translate-x-[3px]"
                    }`}
                  />
                </div>
              </button>
            </div>

            <div className="px-5 pt-6 lg:px-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Account</p>
            </div>

            <div className="mx-5 mt-3 list-card lg:mx-0">
              <button
                type="button"
                onClick={() => setShowLogout(true)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left text-sm font-semibold text-status-overdue transition hover:bg-status-overdue/5"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                Log out
              </button>
            </div>

            <p className="px-5 pt-6 text-center text-[10px] text-ink-muted lg:px-0 lg:text-left">
              Gympay v1.0.0
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showLogout}
        title="Log out"
        message="Are you sure you want to log out of your account?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </>
  );
}
