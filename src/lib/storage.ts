// Small typed wrapper around localStorage.
// Every read and write is wrapped in try/catch: storage can be missing (SSR),
// blocked (privacy settings), full, or hold malformed data. Callers always get
// a usable value back and never see an exception.

import type { CheckIn } from "./types";

export type ThemePreference = "day" | "night";

export type StorageSchema = {
  theme: ThemePreference;
  checkIns: CheckIn[];
};

export type StorageKey = keyof StorageSchema;

const PREFIX = "bwr:";

/** Fired after this tab changes storage, so open views can refresh (the browser only does this for other tabs). */
export const STORAGE_EVENT = "bwr:storagechange";

function announce() {
  try {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    // Nothing is listening during server rendering.
  }
}

/** Exported so the pre-hydration theme script uses the exact same key. */
export const storageKeyFor = (key: StorageKey) => `${PREFIX}${key}`;

function getStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStorage<K extends StorageKey>(
  key: K,
): StorageSchema[K] | null {
  try {
    const raw = getStore()?.getItem(storageKeyFor(key));
    if (raw == null) return null;
    return JSON.parse(raw) as StorageSchema[K];
  } catch {
    return null;
  }
}

/** Returns false when the value could not be saved. */
export function writeStorage<K extends StorageKey>(
  key: K,
  value: StorageSchema[K],
): boolean {
  try {
    const store = getStore();
    if (!store) return false;
    store.setItem(storageKeyFor(key), JSON.stringify(value));
    announce();
    return true;
  } catch {
    return false;
  }
}

/** Most check-ins kept; older ones are dropped first. */
export const MAX_SAVED_CHECK_INS = 120;

/**
 * Saves a completed check-in. Passing the same `date` again replaces that entry,
 * so editing answers after the forecast doesn't create duplicates.
 */
export function saveCheckIn(checkIn: CheckIn): boolean {
  const saved = readStorage("checkIns");
  // A real check-in replaces the demo week; the demo is only there to show what a week looks like.
  const others = (Array.isArray(saved) ? saved : []).filter((c) => c?.date !== checkIn.date && !c?.sample);
  const next = [...others, checkIn]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-MAX_SAVED_CHECK_INS);
  return writeStorage("checkIns", next);
}

export function removeStorage(key: StorageKey): boolean {
  try {
    const store = getStore();
    if (!store) return false;
    store.removeItem(storageKeyFor(key));
    announce();
    return true;
  } catch {
    return false;
  }
}

/** The raw saved text for a key, or "" when nothing is saved or storage is blocked. */
export function readRawStorage(key: StorageKey): string {
  try {
    return getStore()?.getItem(storageKeyFor(key)) ?? "";
  } catch {
    return "";
  }
}

/** For useSyncExternalStore: notified when this tab or another tab changes storage. */
export function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener(STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Everything the app has saved about check-ins. The theme preference is kept. */
export function clearCheckIns(): boolean {
  return removeStorage("checkIns");
}
