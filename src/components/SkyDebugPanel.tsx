"use client";

// TEMPORARY (Phase 1 only): lets us drive the sky by hand.
// Replaced by live check-in scores in Phase 3.

import { BASELINE_SKY, type SkyState } from "@/lib/sky";
import { useSky } from "./SkyProvider";

type NumericKey = Exclude<keyof SkyState, "racing">;

const SLIDERS: { key: NumericKey; label: string }[] = [
  { key: "energy", label: "Energy" },
  { key: "focus", label: "Focus" },
  { key: "mood", label: "Mood" },
  { key: "social", label: "Social battery" },
  { key: "pressure", label: "Burnout pressure" },
];

const PRESETS: { label: string; state: SkyState }[] = [
  { label: "Baseline", state: BASELINE_SKY },
  { label: "Great day", state: { energy: 92, focus: 90, mood: 88, social: 85, pressure: 10 } },
  { label: "Foggy", state: { energy: 50, focus: 18, mood: 55, social: 60, pressure: 40 } },
  { label: "Wired", state: { energy: 65, focus: 35, mood: 50, social: 20, pressure: 55, racing: true } },
  { label: "Storm", state: { energy: 25, focus: 30, mood: 20, social: 25, pressure: 95 } },
];

export function SkyDebugPanel() {
  const { sky, setSky } = useSky();

  return (
    <section
      aria-labelledby="sky-debug-title"
      className="w-full border border-hairline bg-ground p-4 text-ink lg:fixed lg:right-6 lg:bottom-24 lg:z-20 lg:w-80"
    >
      <h2 id="sky-debug-title" className="text-base font-medium">
        Sky debug <span className="font-mono text-xs text-ink-soft">(temporary)</span>
      </h2>

      <div className="mt-3 space-y-3">
        {SLIDERS.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`sky-${key}`} className="flex justify-between text-sm">
              {label}
              <span className="font-mono tabular-nums">{sky[key]}</span>
            </label>
            <input
              id={`sky-${key}`}
              type="range"
              min={0}
              max={100}
              value={sky[key]}
              onChange={(e) => setSky({ ...sky, [key]: Number(e.target.value) })}
              className="w-full accent-cold-front"
            />
          </div>
        ))}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(sky.racing)}
            onChange={(e) => setSky({ ...sky, racing: e.target.checked })}
            className="size-4 accent-cold-front"
          />
          Racing head
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-hairline pt-3">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setSky(p.state)}
            className="font-mono text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
