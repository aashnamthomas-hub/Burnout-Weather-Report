"use client";

import { useCallback, useSyncExternalStore } from "react";
import { writeStorage, type ThemePreference } from "@/lib/storage";

const THEME_EVENT = "bwr:themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// The pre-hydration script in layout.tsx copies any saved preference onto
// <html data-theme>, so the DOM attribute is the single source of truth here.
function resolveTheme(): ThemePreference {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "day" || explicit === "night") return explicit;
  return window.matchMedia(DARK_QUERY).matches ? "night" : "day";
}

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** `theme` is null until hydrated, so the server render never guesses. */
export function useTheme() {
  const theme = useSyncExternalStore<ThemePreference | null>(
    subscribe,
    resolveTheme,
    () => null,
  );

  const setTheme = useCallback((next: ThemePreference) => {
    document.documentElement.dataset.theme = next;
    writeStorage("theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { theme, setTheme };
}
