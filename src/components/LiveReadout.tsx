import type { Change } from "@/lib/readout";
import { signed } from "@/lib/readout";
import type { ScoreKey, Scores } from "@/lib/types";

const ROWS: { key: Exclude<ScoreKey, "pressure">; label: string }[] = [
  { key: "energy", label: "Energy" },
  { key: "focus", label: "Focus" },
  { key: "mood", label: "Mood" },
  { key: "social", label: "Social battery" },
];

type Props = {
  scores: Scores;
  change: Change | null;
};

/** The four scores, how far the last answer moved each, and why. */
export function LiveReadout({ scores, change }: Props) {
  return (
    <section aria-labelledby="readout-title" className="bg-ground p-3 text-ink lg:p-5">
      <h2 id="readout-title" className="text-base font-medium max-lg:sr-only">
        Your forecast so far
      </h2>

      <dl className="grid grid-cols-4 lg:mt-3 gap-2 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-hairline">
        {ROWS.map(({ key, label }) => {
          const delta = change?.deltas[key] ?? 0;
          return (
            <div
              key={key}
              className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between lg:py-2"
            >
              <dt className="text-xs text-ink-soft sm:text-sm lg:text-base lg:text-ink">
                {key === "social" ? (
                  <>
                    <span className="sm:hidden lg:inline">Social</span>
                    <span className="hidden sm:inline">Social battery</span>
                  </>
                ) : (
                  label
                )}
              </dt>
              <dd className="flex items-baseline gap-1.5 font-mono tabular-nums">
                <span className="text-lg sm:text-xl lg:text-2xl">{scores[key]}</span>
                {delta !== 0 && (
                  <>
                    <span aria-hidden="true" className="text-xs text-ink-soft">
                      {delta > 0 ? "▲" : "▼"} {signed(delta)}
                    </span>
                    <span className="sr-only">
                      {delta > 0 ? "up" : "down"} {Math.abs(delta)}
                    </span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <p aria-live="polite" className="mt-2 border-t border-hairline pt-2 text-xs text-ink-soft max-lg:line-clamp-2 sm:text-sm lg:mt-3 lg:min-h-10 lg:pt-3">
        {change === null
          ? "Answer a question and your numbers will move."
          : change.reasons.length > 0
            ? change.reasons.map((reason) => <span key={reason} className="block">{reason}</span>)
            : "That answer didn't move anything."}
      </p>
    </section>
  );
}
