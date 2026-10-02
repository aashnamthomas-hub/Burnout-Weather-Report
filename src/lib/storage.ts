// Small typed wrapper around localStorage.
// Every read and write is wrapped in try/catch: storage can be missing (SSR),
// blocked (privacy settings), full, or hold malformed data. Callers always get
// a usable value back and never see an exception.

export type ThemePreference = "day" | "night";

export type StorageSchema = {
  theme: ThemePreference;
};

export type StorageKey = keyof StorageSchema;

const PREFIX = "bwr:";

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
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: StorageKey): boolean {
  try {
    const store = getStore();
    if (!store) return false;
    store.removeItem(storageKeyFor(key));
    return true;
  } catch {
    return false;
  }
}
