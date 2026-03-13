"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THEME_STORAGE_KEY = "lexi-theme";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  const [theme, setTheme] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const next: Theme = stored === "dark" || stored === "light" ? stored : getSystemTheme();
      applyTheme(next);
      setTheme(next);
    } catch {
      const next = getSystemTheme();
      applyTheme(next);
      setTheme(next);
    }
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("h-9 w-9", className)}
        aria-label="切换深色模式"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("h-9 w-9", className)}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      title={theme === "dark" ? "浅色模式" : "深色模式"}
      disabled={disabled}
      onClick={() => {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
          // ignore
        }
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
