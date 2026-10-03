"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, readRawStorage, subscribeStorage, writeStorage, type Settings } from "@/lib/storage";

function parse(raw: string): Settings {
  try {
    const parsed = JSON.parse(raw) as Partial<Settings> | null;
    return { ...DEFAULT_SETTINGS, cycle: parsed?.cycle === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * The saved settings, or null until the page has hydrated. `update` saves a
 * change; if storage is blocked the choice simply isn't remembered.
 */
export function useSettings() {
  const raw = useSyncExternalStore<string | null>(
    subscribeStorage,
    () => readRawStorage("settings"),
    () => null,
  );
  const settings = useMemo(() => (raw === null ? null : parse(raw)), [raw]);
  const update = (patch: Partial<Settings>) => writeStorage("settings", { ...(settings ?? DEFAULT_SETTINGS), ...patch });
  return { settings, update };
}
