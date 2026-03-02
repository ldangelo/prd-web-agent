"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
} from "react";
import React from "react";

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

interface ThemeContextValue extends ThemeState {
  setPreference: (p: ThemePreference) => void;
}

type ThemeAction =
  | { type: "SET"; pref: ThemePreference }
  | { type: "OS"; resolved: ResolvedTheme };

const ThemeContext = createContext<ThemeContextValue | null>(null);
export const STORAGE_KEY = "theme-preference";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "SYSTEM") return getSystemTheme();
  return pref === "DARK" ? "dark" : "light";
}

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  if (action.type === "SET") {
    return { preference: action.pref, resolved: resolveTheme(action.pref) };
  }
  if (action.type === "OS" && state.preference === "SYSTEM") {
    return { ...state, resolved: action.resolved };
  }
  return state;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored =
    typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as ThemePreference | null)
      : null;
  const init: ThemePreference = stored ?? "SYSTEM";

  const [state, dispatch] = useReducer(themeReducer, {
    preference: init,
    resolved: resolveTheme(init),
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.resolved === "dark");
  }, [state.resolved]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      dispatch({ type: "OS", resolved: e.matches ? "dark" : "light" });
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setPreference = useCallback(async (pref: ThemePreference) => {
    dispatch({ type: "SET", pref });
    localStorage.setItem(STORAGE_KEY, pref);
    try {
      await fetch("/api/user/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreference: pref }),
      });
    } catch {
      // Fail silently if unauthenticated or network error
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ ...state, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
