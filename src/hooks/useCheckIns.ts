"use client";

import { useMemo, useSyncExternalStore } from "react";
import { readRawStorage, subscribeStorage } from "@/lib/storage";
import type { CheckIn } from "@/lib/types";

const SCORE_KEYS = ["energy", "focus", "mood", "social", "pressure"];

/** Keeps only entries that look like real check-ins, so a damaged save can't break a page. */
export function parseCheckIns(raw: string): CheckIn[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CheckIn =>
        Boolean(c) &&
        typeof c.date === "string" &&
        Number.isFinite(Date.parse(c.date)) &&
        Boolean(c.scores) &&
        SCORE_KEYS.every((k) => Number.isFinite(c.scores[k])),
    );
  } catch {
    return [];
  }
}

/**
 * Saved check-ins, read from localStorage. The result is null until the page
 * has hydrated, so the server render and the first client render match.
 */
export function useCheckIns(): CheckIn[] | null {
  const raw = useSyncExternalStore<string | null>(
    subscribeStorage,
    () => readRawStorage("checkIns"),
    () => null,
  );
  return useMemo(() => (raw === null ? null : parseCheckIns(raw)), [raw]);
}
