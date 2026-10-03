"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCheckIns } from "@/hooks/useCheckIns";
import { lastDays } from "@/lib/days";
import { REPORT } from "@/lib/report";
import { generateInsight } from "@/lib/insights";
import { sampleWeek } from "@/lib/sample";
import { BASELINE_SKY } from "@/lib/sky";
import { clearAllData, hasCycleData, removeCycleData, writeStorage } from "@/lib/storage";
import type { CheckIn } from "@/lib/types";
import { WeekChart } from "./WeekChart";
import { useSky } from "./SkyProvider";

const primaryButton =
  "inline-flex min-h-12 items-center border border-isobar bg-low-sun px-6 py-3 text-lg text-isobar transition-opacity hover:opacity-90";
const secondaryButton =
  "inline-flex min-h-12 items-center border border-hairline bg-ground px-6 py-3 text-lg text-ink transition-colors hover:border-ink";
const textButton = "inline-flex min-h-11 items-center text-base text-ink underline underline-offset-4 decoration-from-font hover:no-underline";

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/** The week as a climate chart: seven days of energy, focus and burnout pressure, with one sentence about them. */
export function WeekView() {
  const saved = useCheckIns();
  // If the browser blocks storage, the sample week is kept in memory so it still shows.
  const [memorySample, setMemorySample] = useState<CheckIn[] | null>(null);
  const checkIns = saved && saved.length === 0 && memorySample ? memorySample : saved;
  const { setSky } = useSky();
  const [confirming, setConfirming] = useState(false);
  // The clock is only read once the saved check-ins are (after hydration), so the server and first client render match.
  const now = useMemo(() => (checkIns ? new Date() : null), [checkIns]);

  const view = useMemo(() => {
    if (!checkIns || !now) return null;
    const days = lastDays(checkIns, now);
    const logged = days.filter((d) => d.checkIn).map((d) => d.checkIn!);
    return {
      days,
      logged,
      insight: generateInsight(checkIns, now),
      sample: logged.length > 0 && logged.every((c) => c.sample),
    };
  }, [checkIns, now]);

  // The sky takes on the week's average weather.
  const averages = useMemo(() => {
    if (!view || view.logged.length === 0) return BASELINE_SKY;
    const avg = (k: "energy" | "focus" | "mood" | "social" | "pressure") => mean(view.logged.map((c) => c.scores[k]));
    return { energy: avg("energy"), focus: avg("focus"), mood: avg("mood"), social: avg("social"), pressure: avg("pressure") };
  }, [view]);
  useEffect(() => {
    setSky(averages);
  }, [averages, setSky]);

  if (!view || !now) {
    return <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-8" aria-busy="true" />;
  }

  const empty = view.logged.length === 0;
  const first = view.days[0].date;
  const last = view.days[view.days.length - 1].date;
  const range = `${first.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${last.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  return (
    <>
      <section
        aria-labelledby="week-headline"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-4 pt-16 pb-10 text-sky-ink sm:px-8 lg:pt-28"
      >
        <p className="font-mono text-sm">Your week, {range}</p>
        <h1
          id="week-headline"
          className="mt-3 max-w-4xl text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl"
        >
          {empty ? "No weather records yet." : view.insight.text}
        </h1>
        {empty ? (
          <p className="mt-5 max-w-2xl text-lg text-pretty sm:text-xl">
            Take your first check-in and your week starts to fill in here. Or see what a full week looks like first.
          </p>
        ) : (
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm tabular-nums">
            <span>Energy {mean(view.logged.map((c) => c.scores.energy))}</span>
            <span>Focus {mean(view.logged.map((c) => c.scores.focus))}</span>
            <span>Pressure {mean(view.logged.map((c) => c.scores.pressure))}</span>
            <span>
              {view.logged.length} check-in{view.logged.length === 1 ? "" : "s"}
            </span>
          </p>
        )}
      </section>

      <div className="border-t border-ink bg-ground text-ink">
        <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-12 sm:px-8">
          <section aria-labelledby="chart-title">
            <h2 id="chart-title" className="text-2xl font-normal">
              The week as a climate chart
            </h2>
            {view.sample && (
              <p className="mt-2 font-mono text-xs">
                Sample week: made-up numbers to show how this looks. Your own check-ins replace it.
              </p>
            )}
            <div className="relative mt-4">
              {/* Two sizes of the same chart so the labels stay readable on a phone. */}
              <ul className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs" aria-hidden="true">
                <li className="flex items-center gap-2"><svg width="24" height="6"><line x1="0" x2="24" y1="3" y2="3" stroke="currentColor" strokeWidth="2.6" /></svg>Energy</li>
                <li className="flex items-center gap-2"><svg width="24" height="6"><line x1="0" x2="24" y1="3" y2="3" stroke="var(--line-focus)" strokeWidth="2.2" strokeDasharray="6 5" /></svg>Focus</li>
                <li className="flex items-center gap-2"><svg width="24" height="6"><line x1="0" x2="24" y1="3" y2="3" stroke="var(--line-pressure)" strokeWidth="2.6" /></svg>Burnout pressure</li>
              </ul>
              <div className="sm:hidden">
                <WeekChart days={view.days} empty={empty} width={380} legend={false} />
              </div>
              <div className="hidden sm:block">
                <WeekChart days={view.days} empty={empty} legend={false} />
              </div>
              {empty && (
                <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                  <p className="max-w-xs bg-ground px-4 py-3 text-lg text-pretty">
                    Your seven days will appear here, one point for each check-in.
                  </p>
                </div>
              )}
            </div>
          </section>

          {!empty && (
            <section aria-labelledby="table-title">
              <h2 id="table-title" className="text-2xl font-normal">
                The numbers
              </h2>
              <table className="mt-4 w-full max-w-3xl border-y border-hairline text-left">
                <thead>
                  <tr className="border-b border-hairline font-mono text-xs text-ink-soft">
                    <th scope="col" className="py-2 pr-2 font-normal">Day</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Energy</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Focus</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Pressure</th>
                    <th scope="col" className="py-2 font-normal">Crash risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline font-mono text-sm tabular-nums">
                  {view.days.map((d) => {
                    const c = d.checkIn;
                    const alarm = c && c.crash >= REPORT.crashAlarmFrom;
                    return (
                      <tr key={d.date.toISOString()}>
                        <th scope="row" className="py-2 pr-2 font-normal">
                          {d.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                        </th>
                        {c ? (
                          <>
                            <td className="py-2 pr-2">{c.scores.energy}</td>
                            <td className="py-2 pr-2">{c.scores.focus}</td>
                            <td className="py-2 pr-2">{c.scores.pressure}</td>
                            <td className="py-2" style={alarm ? { color: "var(--warn-text)" } : undefined}>
                              {c.crash}%
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} className="py-2 text-ink-soft">
                            no check-in
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link href="/" className={primaryButton}>
              {empty ? "Start my first check-in" : "Start a check-in"}
            </Link>

            {empty && (
              <button type="button" className={secondaryButton} onClick={() => {
                  const week = sampleWeek(new Date());
                  if (!writeStorage("checkIns", week)) setMemorySample(week);
                }}>
                Load sample week
              </button>
            )}

            {!empty &&
              (confirming ? (
                <span role="group" aria-label="Confirm clearing your data" className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-base">Delete every saved check-in?</span>
                  <button
                    type="button"
                    className={textButton}
                    onClick={() => {
                      clearAllData();
                      setMemorySample(null);
                      setConfirming(false);
                    }}
                  >
                    Yes, clear my data
                  </button>
                  <button type="button" className={textButton} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" className={secondaryButton} onClick={() => setConfirming(true)}>
                  Clear my data
                </button>
              ))}
          </div>
          <p className="max-w-2xl text-base text-ink-soft text-pretty">
            Your check-ins are saved only in this browser. Clearing them can&apos;t be undone.
          </p>
          {checkIns && hasCycleData(checkIns) && (
            <p className="max-w-2xl text-base text-ink-soft text-pretty">
              Cycle info stays in this browser.{" "}
              <button type="button" className={textButton} onClick={() => removeCycleData()}>
                Remove cycle data
              </button>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
