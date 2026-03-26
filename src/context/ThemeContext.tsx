import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

function getInitial(): Theme {
  try {
    const stored = localStorage.getItem("gympay-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch { /* SSR / private mode */ }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("gympay-theme", theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0B0F14" : "#F0F2F5");
  }, [theme]);

  function toggle() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
