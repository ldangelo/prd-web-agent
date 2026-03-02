"use client";
import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "LIGHT", label: "Light", Icon: Sun },
  { value: "DARK", label: "Dark", Icon: Moon },
  { value: "SYSTEM", label: "System", Icon: Monitor },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Color theme" className="flex items-center gap-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          onClick={() => setPreference(value)}
          className={`p-2 rounded-md transition-colors ${
            preference === value
              ? "bg-[rgb(var(--nav-item-active))] text-white"
              : "text-[rgb(var(--nav-foreground))] hover:bg-[rgb(var(--nav-item-hover))]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
