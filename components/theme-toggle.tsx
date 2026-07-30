"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Mirror the active theme into a cookie so server components (e.g. the
  // snippet page) can resolve the correct Shiki highlight theme.
  useEffect(() => {
    if (theme) {
      document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [theme]);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Toggle dark mode">
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={
        resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      title="Toggle dark mode"
    >
      {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}
