import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/dashboard", icon: "home", label: "Home" },
  { to: "/payments", icon: "receipt_long", label: "History" },
  { to: "/members", icon: "group", label: "Members" },
  { to: "/settings", icon: "settings", label: "Settings" },
] as const;

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] lg:hidden">
      <div className="mx-auto flex h-16 items-center justify-around rounded-2xl bg-elevated shadow-level2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 transition-all duration-200 ease-out ${
                isActive
                  ? "text-primary"
                  : "text-ink-muted hover:text-ink-secondary"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center rounded-full transition-all duration-200 ease-out ${
                    isActive
                      ? "h-9 w-9 bg-primary text-white shadow-glow-blue"
                      : "h-9 w-9"
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{t.icon}</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
