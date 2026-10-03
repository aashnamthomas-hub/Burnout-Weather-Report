"use client";

import { useRef, useState, type DragEvent } from "react";
import { CALENDAR_RULES, formatDuration, formatMinutes } from "@/lib/calendar";
import type { CalendarSummary } from "@/lib/types";

type Props = {
  summary: CalendarSummary | undefined;
  useTitles: boolean;
  onUseTitles: (on: boolean) => void;
  onSample: () => void;
  /** Called with the text of a chosen .ics file; returns an error message, or null when it worked. */
  onIcs: (text: string) => string | null;
  onSkip: () => void;
  onRemove: () => void;
  onContinue: () => void;
  onBack?: () => void;
  onRestart: () => void;
};

const primaryButton =
  "border border-isobar bg-low-sun px-6 py-3 text-lg text-isobar transition-opacity hover:opacity-90";
const choice =
  "flex min-h-14 w-full flex-col items-start justify-center border border-hairline bg-ground px-4 py-2.5 text-left text-ink transition-colors hover:border-ink sm:px-5 sm:py-3";
const textButton =
  "inline-flex min-h-11 items-center text-base text-sky-ink underline underline-offset-4 decoration-from-font hover:no-underline";

export function CalendarStep({ summary, useTitles, onUseTitles, onSample, onIcs, onSkip, onRemove, onContinue, onBack, onRestart }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > CALENDAR_RULES.maxFileBytes) return setMessage("That file is too large. Calendar files are usually well under 2 MB.");
    try {
      const error = onIcs(await file.text());
      setMessage(error ?? "");
    } catch {
      setMessage("Couldn't read that file. Try exporting it again.");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void readFile(e.dataTransfer.files?.[0]);
  };

  return (
    <section aria-labelledby="calendar-title" className="mt-5 max-w-2xl sm:mt-8">
      <h2 id="calendar-title" className="text-2xl leading-tight font-normal text-balance sm:text-3xl lg:text-4xl">
        Want to add today&apos;s calendar?
      </h2>
      <p className="mt-2 text-base text-pretty sm:mt-3 sm:text-lg">
        Optional. Start and end times are enough to see your real gaps and back-to-back runs. Your calendar is read in
        your browser and never leaves it.
      </p>

      {summary ? (
        <div className="mt-5">
          <div className="border border-hairline bg-ground p-4 text-ink">
            <p className="text-lg">
              {summary.count} meeting{summary.count === 1 ? "" : "s"}, {formatDuration(summary.totalMinutes)} in total
              {summary.source === "sample" && <span className="font-mono text-xs text-ink-soft"> · sample day</span>}
            </p>
            <ul className="mt-2 space-y-1 text-base text-ink-soft">
              {summary.longestRunMinutes >= 60 && summary.longestRunStart !== null && summary.longestRunEnd !== null && (
                <li>
                  Longest back-to-back run: {formatDuration(summary.longestRunMinutes)}, {formatMinutes(summary.longestRunStart)} to{" "}
                  {formatMinutes(summary.longestRunEnd)}
                </li>
              )}
              <li>
                {summary.gaps.length
                  ? `Free gaps: ${summary.gaps.map((g) => `${formatMinutes(g.start)} to ${formatMinutes(g.end)}`).join(", ")}`
                  : "No free gaps of 15 minutes or more"}
              </li>
              {summary.firstStart !== null && <li>First meeting at {formatMinutes(summary.firstStart)}</li>}
              {summary.allDay > 0 && <li>{summary.allDay} all-day event{summary.allDay === 1 ? "" : "s"}, not counted as meetings</li>}
            </ul>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={useTitles}
            onClick={() => onUseTitles(!useTitles)}
            className={`mt-3 flex min-h-12 w-full items-center justify-between gap-4 border px-4 py-2.5 text-left text-base transition-colors sm:text-lg ${
              useTitles ? "border-isobar bg-low-sun text-isobar" : "border-hairline bg-ground text-ink hover:border-ink"
            }`}
          >
            <span>
              Use event titles for smarter tips
              <span className={`block text-sm ${useTitles ? "text-isobar" : "text-ink-soft"}`}>Titles stay in memory for this check-in and are never saved.</span>
            </span>
            <span className="font-mono text-sm">{useTitles ? "On" : "Off"}</span>
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
            <button type="button" onClick={onContinue} className={primaryButton}>
              Continue
            </button>
            <button type="button" onClick={onRemove} className={textButton}>
              Remove calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-2 sm:space-y-3">
          <button type="button" onClick={onSample} className={choice}>
            <span className="text-base sm:text-lg">Try a sample calendar</span>
            <span className="text-sm text-ink-soft">A made-up day with six meetings, so you can see how it works</span>
          </button>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={dragging ? "outline-2 outline-dashed outline-offset-2 outline-[var(--focus-ring)]" : ""}
          >
            <input
              ref={picker}
              type="file"
              accept=".ics,text/calendar"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a calendar file (.ics)"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => picker.current?.click()} className={choice}>
              <span className="text-base sm:text-lg">Import an .ics file</span>
              <span className="text-sm text-ink-soft">Choose a file, or drop it here. Export one from Google Calendar, Outlook or Apple Calendar.</span>
            </button>
          </div>

          <button type="button" onClick={onSkip} className={choice}>
            <span className="text-base sm:text-lg">Skip</span>
            <span className="text-sm text-ink-soft">I&apos;ll answer a question about my meetings instead</span>
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-base">
        {message}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
        {onBack && (
          <button type="button" onClick={onBack} className={textButton}>
            Back
          </button>
        )}
        <button type="button" onClick={onRestart} className={textButton}>
          Start over
        </button>
      </div>
    </section>
  );
}
