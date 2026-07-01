"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

export type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: "class" | `data-${string}`;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
};

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme | undefined;
  setTheme: (theme: Theme) => void;
};

const DEFAULT_STORAGE_KEY = "theme";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof window === "undefined") return fallback;

  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return fallback;
}

function applyTheme(options: {
  attribute: ThemeProviderProps["attribute"];
  disableTransitionOnChange: boolean;
  resolvedTheme: ResolvedTheme;
}) {
  if (typeof document === "undefined") return;

  const { attribute = "class", disableTransitionOnChange, resolvedTheme } = options;
  const root = document.documentElement;

  let cleanupTransition: (() => void) | undefined;

  if (disableTransitionOnChange) {
    const style = document.createElement("style");
    style.appendChild(
      document.createTextNode("*,*::before,*::after{transition:none!important}")
    );
    document.head.appendChild(style);
    cleanupTransition = () => {
      void window.getComputedStyle(document.body);
      requestAnimationFrame(() => {
        style.remove();
      });
    };
  }

  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  } else {
    root.setAttribute(attribute, resolvedTheme);
  }

  root.style.colorScheme = resolvedTheme;
  cleanupTransition?.();
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    getStoredTheme(storageKey, defaultTheme)
  );
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() => getSystemTheme());

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", updateSystemTheme);
    };
  }, []);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, nextTheme);
      }
    },
    [storageKey]
  );

  const resolvedTheme = React.useMemo<ResolvedTheme>(() => {
    if (theme === "system") {
      return enableSystem ? systemTheme : "light";
    }

    return theme;
  }, [enableSystem, systemTheme, theme]);

  React.useEffect(() => {
    applyTheme({
      attribute,
      disableTransitionOnChange,
      resolvedTheme,
    });
  }, [attribute, disableTransitionOnChange, resolvedTheme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }

  return context;
}
