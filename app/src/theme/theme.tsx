import { createContext, FC, ReactNode, useContext, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";

const KEY = "bsfly-theme";
const media = () => (typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null);

const readPref = (): ThemePref => {
  try {
    const stored = window.localStorage?.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

const resolve = (pref: ThemePref) => (pref === "system" ? (media()?.matches ? "dark" : "light") : pref);

export const applyTheme = (pref: ThemePref = readPref()) => {
  const mode = resolve(pref);
  document.documentElement.classList.toggle("ion-palette-dark", mode === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0f1311" : "#f4f3ee");
  return mode;
};

interface ThemeContextValue {
  pref: ThemePref;
  mode: "light" | "dark";
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [mode, setMode] = useState<"light" | "dark">(() => applyTheme(readPref()));

  useEffect(() => {
    setMode(applyTheme(pref));
    if (pref !== "system") return;
    const mq = media();
    if (!mq || typeof mq.addEventListener !== "function") return;
    const onChange = () => setMode(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = (next: ThemePref) => {
    try {
      window.localStorage?.setItem(KEY, next);
    } catch {
      setPrefState(next);
      return;
    }
    setPrefState(next);
  };

  return <ThemeContext.Provider value={{ pref, mode, setPref }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
