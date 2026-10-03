"use client";

import { useState } from "react";
import { useCheckIns } from "@/hooks/useCheckIns";
import { useSettings } from "@/hooks/useSettings";
import { clearAllData, hasCycleData, removeCycleData } from "@/lib/storage";

const secondaryButton =
  "inline-flex min-h-12 items-center border border-hairline bg-ground px-6 py-3 text-lg text-ink transition-colors hover:border-ink";
const textButton = "inline-flex min-h-11 items-center text-base text-ink underline underline-offset-4 decoration-from-font hover:no-underline";

/** Settings: the cycle switch and the two ways to remove what is saved. Everything here stays in this browser. */
export function SettingsView() {
  const { settings, update } = useSettings();
  const checkIns = useCheckIns();
  const [local, setLocal] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");

  const cycleOn = local ?? settings?.cycle ?? false;
  const hasData = (checkIns?.length ?? 0) > 0;
  const hasCycle = checkIns ? hasCycleData(checkIns) : false;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 lg:py-20">
      <h1 className="text-4xl leading-tight font-normal tracking-tight sm:text-5xl">Settings</h1>
      <p className="mt-3 text-lg text-ink-soft text-pretty">Everything on this page stays in this browser.</p>

      <section aria-labelledby="cycle-title" className="mt-12 border-t border-hairline pt-6">
        <h2 id="cycle-title" className="text-2xl font-normal">Cycle</h2>
        <p className="mt-2 text-lg text-pretty">
          Factor in your cycle? Optional, and private to this browser. When it is on, the check-in asks where you are in
          your cycle. Only your own answers are used. Nothing is guessed from dates.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={cycleOn}
          disabled={settings === null}
          onClick={() => {
            setLocal(!cycleOn);
            update({ cycle: !cycleOn });
          }}
          className={`mt-4 flex min-h-14 w-full items-center justify-between gap-4 border px-5 py-3 text-left text-lg transition-colors ${
            cycleOn ? "border-isobar bg-low-sun text-isobar" : "border-hairline bg-ground text-ink hover:border-ink"
          }`}
        >
          <span>Factor in my cycle</span>
          <span className="font-mono text-sm">{cycleOn ? "On" : "Off"}</span>
        </button>
        <p className="mt-3 text-base text-ink-soft">Cycle info stays in this browser.</p>
        {hasCycle && (
          <button
            type="button"
            className={`${secondaryButton} mt-4`}
            onClick={() => {
              removeCycleData();
              setLocal(false);
              setMessage("Cycle data removed.");
            }}
          >
            Remove cycle data
          </button>
        )}
      </section>

      <section aria-labelledby="data-title" className="mt-12 border-t border-hairline pt-6">
        <h2 id="data-title" className="text-2xl font-normal">Your data</h2>
        <p className="mt-2 text-lg text-pretty">
          Check-ins are saved only in this browser, so nobody else can see them. Calendar files are read in your browser
          and are never saved. Event titles are never stored.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {confirming ? (
            <span role="group" aria-label="Confirm clearing your data" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-base">Delete every saved check-in and setting?</span>
              <button
                type="button"
                className={textButton}
                onClick={() => {
                  clearAllData();
                  setLocal(false);
                  setConfirming(false);
                  setMessage("Everything was cleared.");
                }}
              >
                Yes, clear my data
              </button>
              <button type="button" className={textButton} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className={secondaryButton} onClick={() => setConfirming(true)} disabled={!hasData && !cycleOn}>
              Clear my data
            </button>
          )}
        </div>
      </section>

      <p role="status" aria-live="polite" className="mt-6 min-h-6 font-mono text-sm">
        {message}
      </p>
    </div>
  );
}
