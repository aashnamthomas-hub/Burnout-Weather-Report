"use client";

import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "night" ? "day" : "night";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // Hidden until hydrated so the label never shows the wrong sky.
      className={`flex min-h-11 items-center gap-2 px-1 font-mono text-sm text-sky-ink transition-opacity hover:opacity-70 ${theme ? "" : "invisible"}`}
      aria-label={`Switch to ${next} sky`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {next === "night" ? (
          <path d="M11.5 10.6A5 5 0 0 1 5.4 4.5 5 5 0 1 0 11.5 10.6Z" fill="currentColor" />
        ) : (
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none">
            <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
            <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
          </g>
        )}
      </svg>
      <span className="max-sm:sr-only whitespace-nowrap">{next === "night" ? "Night sky" : "Day sky"}</span>
    </button>
  );
}
