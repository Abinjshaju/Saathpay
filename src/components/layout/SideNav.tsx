import { NavLink } from "react-router-dom";
import GympayLogo from "@/components/branding/GympayLogo";

const tabs = [
  { to: "/dashboard", icon: "home", label: "Home" },
  { to: "/payments", icon: "receipt_long", label: "Payment History" },
  { to: "/members", icon: "group", label: "Members" },
  { to: "/settings", icon: "settings", label: "Settings" },
] as const;

export default function SideNav() {
  return (
    <aside className="fixed left-0 top-0 hidden h-dvh w-56 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-14 items-center border-b border-border px-5">
        <GympayLogo size="sm" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pt-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ease-out ${
                isActive
                  ? "border-l-2 border-lime bg-elevated text-ink"
                  : "border-l-2 border-transparent text-ink-secondary hover:bg-elevated hover:text-ink"
              }`
            }
          >
            <span className="material-symbols-outlined text-xl">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-[10px] text-ink-muted">Gympay v1.0.0</p>
      </div>
    </aside>
  );
}
