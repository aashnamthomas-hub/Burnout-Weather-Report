import type { ScoreResult } from "@/lib/forecast";
import type { Picked } from "@/lib/recommendations";
import { signed, SCORE_NAMES } from "@/lib/readout";
import type { Report } from "@/lib/report";
import type { ScoreKey } from "@/lib/types";
import type { Achievement } from "@/lib/achievements";
import { SUPPORT_NOTE } from "@/lib/safety";
import type { Feeling, Suggestion } from "@/lib/suggestions";
import { DayStrip } from "./DayStrip";
import { MoodSuggestions } from "./MoodSuggestions";
import { ShareCard } from "./ShareCard";
import { PressureGauge } from "./PressureGauge";

type Props = {
  report: Report;
  recommendations: Picked[];
  result: ScoreResult;
  now: Date;
  suggestions: { feeling: Feeling; items: Suggestion[] };
  streak: number;
  achievements: Achievement[];
  racing: boolean;
  /** Show the gentle note after several very low days in a row. */
  supportNote: boolean;
  onBack: () => void;
  onRestart: () => void;
};

const SCORE_ROWS: { key: Exclude<ScoreKey, "pressure">; label: string }[] = [
  { key: "energy", label: "Energy" },
  { key: "focus", label: "Focus" },
  { key: "mood", label: "Mood" },
  { key: "social", label: "Social battery" },
];

const KEYS: ScoreKey[] = ["energy", "focus", "mood", "social", "pressure"];

const textButton = "inline-flex min-h-11 items-center text-base text-ink underline underline-offset-4 decoration-from-font hover:no-underline";
const primaryButton =
  "border border-isobar bg-low-sun px-6 py-3 text-lg text-isobar transition-opacity hover:opacity-90";

/** The result screen: the headline sits on the sky, the report on solid ground below the horizon. */
export function ForecastReport({
  report,
  recommendations,
  result,
  now,
  suggestions,
  streak,
  achievements,
  racing,
  supportNote,
  onBack,
  onRestart,
}: Props) {
  const dateLine = now.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <>
      <h1 className="sr-only">Burnout Weather Report: your forecast</h1>
      <section
        aria-labelledby="forecast-headline"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-4 pt-20 pb-10 text-sky-ink sm:px-8 lg:pt-32"
      >
        <p className="font-mono text-sm">{dateLine}</p>
        <h2
          id="forecast-headline"
          tabIndex={-1}
          className="mt-3 max-w-4xl text-4xl leading-[1.05] font-normal tracking-tight text-balance outline-none sm:text-6xl"
        >
          {report.headline}
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-pretty sm:text-xl">{report.summary}</p>
        <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm tabular-nums">
          {SCORE_ROWS.map(({ key, label }) => (
            <span key={key}>
              {label} {result.scores[key]}
            </span>
          ))}
        </p>
      </section>

      {/* The horizon: everything below sits on solid ground. */}
      <div className="border-t border-ink bg-ground text-ink">
        <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-12 sm:px-8">
          {supportNote && (
            <aside aria-labelledby="support-title" className="max-w-3xl border-l-2 border-ink py-1 pl-4">
              <h3 id="support-title" className="text-xl font-medium">{SUPPORT_NOTE.title}</h3>
              <p className="mt-1 text-lg text-pretty">{SUPPORT_NOTE.body}</p>
              <p className="mt-2 text-base text-ink-soft text-pretty">{SUPPORT_NOTE.urgent}</p>
            </aside>
          )}

          {report.stormWarning && (
            <p
              role="note"
              className="max-w-3xl border-l-2 py-1 pl-4 text-xl text-pretty"
              style={{ borderColor: "var(--warm-front)" }}
            >
              <span className="font-mono text-sm" style={{ color: "var(--warn-text)" }}>
                Storm warning
              </span>
              <br />
              {report.stormWarning}
            </p>
          )}

          <DayStrip blocks={report.blocks} crash={result.crash} />

          {report.tomorrowNote && (
            <p className="max-w-3xl text-lg text-pretty">
              <span className="font-medium">Tomorrow.</span> {report.tomorrowNote}
            </p>
          )}

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
            <section aria-labelledby="recs-title">
              <h3 id="recs-title" className="text-2xl font-normal">
                {report.good ? "Keep it simple" : "What to do about it"}
              </h3>
              <ol className="mt-4 divide-y divide-hairline border-y border-hairline">
                {recommendations.map((rec) => (
                  <li key={rec.id} className="py-4">
                    <p className="text-xl leading-snug text-pretty">{rec.text}</p>
                    <p className="mt-1 text-base text-ink-soft text-pretty">{rec.reason}</p>
                    {rec.when && <p className="mt-2 font-mono text-xs">{rec.when}</p>}
                  </li>
                ))}
              </ol>
            </section>

            <PressureGauge pressure={report.pressure} />
          </div>

          <MoodSuggestions feeling={suggestions.feeling} items={suggestions.items} />

          <ShareCard
            report={report}
            scores={result.scores}
            crash={result.crash}
            racing={racing}
            now={now}
            streak={streak}
            achievements={achievements}
          />

          <details className="group max-w-3xl border-y border-hairline">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-xl [&::-webkit-details-marker]:hidden">
              Why this forecast?
              <span aria-hidden="true" className="font-mono text-sm text-ink-soft group-open:hidden">Show</span>
              <span aria-hidden="true" className="hidden font-mono text-sm text-ink-soft group-open:inline">Hide</span>
            </summary>
            <div className="pb-5">
              <p className="text-base text-ink-soft text-pretty">
                Every rule that moved a number, and by how much. Starting points: energy 70, focus 70, mood 65, social
                battery 70, pressure 30, crash chance 10%.
              </p>
              <ul className="mt-4 divide-y divide-hairline">
                {result.rules.map((rule) => {
                  const parts = KEYS.filter((k) => rule.delta[k]).map(
                    (k) => `${SCORE_NAMES[k]} ${signed(rule.delta[k] ?? 0)}`,
                  );
                  if (rule.delta.crash) parts.push(`crash chance ${signed(rule.delta.crash)}%`);
                  return (
                    <li key={rule.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-6">
                      <span>{rule.label}</span>
                      <span className="font-mono text-sm tabular-nums sm:text-right">{parts.join(" · ")}</span>
                    </li>
                  );
                })}
                {result.rules.length === 0 && <li className="py-2">No rule moved a number, so everything is at its starting point.</li>}
              </ul>
              <p className="mt-4 text-sm text-ink-soft text-pretty">
                The direction of each rule follows common sleep, nutrition and exercise guidance. The exact values are
                adjustable guesses, not clinical measurements.
              </p>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" onClick={onBack} className={textButton}>
              Back
            </button>
            <button type="button" onClick={onRestart} className={primaryButton}>
              Start a new check-in
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
