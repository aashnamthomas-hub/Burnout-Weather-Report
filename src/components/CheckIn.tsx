"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/hooks/useSettings";
import { computeStats, earnedAchievements } from "@/lib/achievements";
import { readCalendar, sampleCalendar, type CalendarEvent } from "@/lib/calendar";
import { computeScores } from "@/lib/forecast";
import {
  QUESTION_BY_ID,
  getNextQuestion,
  getProgress,
  pruneAnswers,
  visibleFields,
  type QuestionId,
  type QuestionOptions,
} from "@/lib/questions";
import { describeChange } from "@/lib/readout";
import { pickRecommendations, type EventNote } from "@/lib/recommendations";
import { buildReport, isGoodDay, modeFor } from "@/lib/report";
import { cycleNotes, needsSupportNote } from "@/lib/safety";
import { CYCLE_ANSWER_KEYS, readStorage, removeCycleData, saveCheckIn } from "@/lib/storage";
import { daySeed, pickSuggestions } from "@/lib/suggestions";
import type { Answers, CheckIn as SavedCheckIn } from "@/lib/types";
import { CalendarStep } from "./CalendarStep";
import { ChipGroup } from "./ChipGroup";
import { ChipMulti } from "./ChipMulti";
import { ForecastReport } from "./ForecastReport";
import { LiveReadout } from "./LiveReadout";
import { useSky } from "./SkyProvider";

type Step = QuestionId | "calendar" | "done";

const EPOCH = new Date(0);

const primaryButton =
  "border border-isobar bg-low-sun px-6 py-3 text-lg text-isobar transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const textButton =
  "inline-flex min-h-11 items-center text-base text-sky-ink underline underline-offset-4 decoration-from-font hover:no-underline";

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function CheckIn() {
  const { setSky } = useSky();
  const { settings, update: updateSettings } = useSettings();
  // Local choice first, so the cycle opt-in still works if the browser blocks storage.
  const [cycleChoice, setCycleChoice] = useState<boolean | null>(null);
  const cycleEnabled = cycleChoice ?? settings?.cycle ?? false;
  const options: QuestionOptions = useMemo(() => ({ cycle: cycleEnabled }), [cycleEnabled]);

  const [started, setStarted] = useState(false);
  const [now, setNow] = useState<Date>(EPOCH);
  const [history, setHistory] = useState<SavedCheckIn[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [before, setBefore] = useState<Answers | null>(null);
  const [path, setPath] = useState<Step[]>([]);
  // Calendar event titles live only here, in memory, and only if the person allows them.
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [useTitles, setUseTitles] = useState(false);

  const result = useMemo(() => computeScores(answers, history, now), [answers, history, now]);
  const change = useMemo(
    () => (before ? describeChange(computeScores(before, history, now), result) : null),
    [before, history, now, result],
  );

  // The sky follows the live scores after every answer.
  const racing = answers.head === "racing";
  useEffect(() => {
    setSky({ ...result.scores, racing });
  }, [result.scores, racing, setSky]);

  const step: Step | undefined = path[path.length - 1];

  const report = useMemo(
    () => (step === "done" ? buildReport(answers, result, history.length, now) : null),
    [step, answers, result, history.length, now],
  );

  const titles: EventNote[] | undefined = useMemo(
    () =>
      useTitles && events
        ? events.filter((e) => !e.allDay && e.title).map((e) => ({ title: e.title!, start: minutesOf(e.start), end: minutesOf(e.end) }))
        : undefined,
    [useTitles, events],
  );

  const recommendations = useMemo(
    () =>
      step === "done"
        ? pickRecommendations({
            a: answers,
            r: result,
            hour: now.getHours(),
            minutes: minutesOf(now),
            titles,
            mode: modeFor(now),
            good: isGoodDay(result),
          })
        : [],
    [step, answers, result, now, titles],
  );

  const suggestions = useMemo(
    () => pickSuggestions({ answers, scores: result.scores, good: isGoodDay(result), seed: daySeed(now) }),
    [answers, result, now],
  );
  const { stats, achievements } = useMemo(() => {
    const today = { date: now.toISOString(), scores: result.scores, crash: result.crash };
    return { stats: computeStats(history, today, now), achievements: earnedAchievements(history, today, now) };
  }, [history, result, now]);

  // Each finished check-in is saved once; changing an answer afterwards updates the same entry.
  // Saved answers hold numbers and times from a calendar, never event titles.
  const savedDate = useRef<string | null>(null);
  useEffect(() => {
    if (step !== "done") return;
    const date = savedDate.current ?? now.toISOString();
    savedDate.current = date;
    saveCheckIn({ date, answers, scores: result.scores, crash: result.crash });
  }, [step, answers, result, now]);

  // Move keyboard focus to the headline when the forecast appears.
  useEffect(() => {
    if (step === "done") document.getElementById("forecast-headline")?.focus({ preventScroll: true });
  }, [step]);

  const goTo = (nextAnswers: Answers, clock: Date) => {
    const next = getNextQuestion(nextAnswers, history, clock, options);
    setPath((p) => [...p, next === "done" ? "done" : next.id]);
  };

  const start = () => {
    const clock = new Date();
    // Past check-ins are read when the check-in starts, never during server rendering.
    const saved = readStorage("checkIns");
    // The demo week is never treated as real history.
    const past = Array.isArray(saved) ? saved.filter((c) => !c?.sample) : [];
    setHistory(past);
    setNow(clock);
    setStarted(true);
    setPath(["calendar"]);
  };

  const restart = () => {
    savedDate.current = null;
    window.scrollTo({ top: 0 });
    setAnswers({});
    setBefore(null);
    setEvents(null);
    setUseTitles(false);
    setPath([]);
    setStarted(false);
    setNow(EPOCH);
  };

  const back = () => setPath((p) => p.slice(0, -1));

  /** Records one answer, re-scores, and drops follow-up answers that no longer apply. */
  const record = (updates: Partial<Answers>, advance: boolean) => {
    const clock = new Date();
    const next = pruneAnswers({ ...answers, ...updates }, history, clock, options);
    setBefore(answers);
    setAnswers(next);
    setNow(clock);
    if (advance) goTo(next, clock);
  };

  const removeCalendar = () => {
    const next = { ...answers };
    delete next.calendar;
    setBefore(answers);
    setAnswers(pruneAnswers(next, history, new Date(), options));
    setEvents(null);
    setUseTitles(false);
  };

  const removeCycle = () => {
    removeCycleData();
    setCycleChoice(false);
    const next = { ...answers } as Record<string, unknown>;
    for (const key of CYCLE_ANSWER_KEYS) delete next[key];
    setAnswers(next as Answers);
  };

  const chooseCycle = (on: boolean) => {
    setCycleChoice(on);
    updateSettings({ cycle: on });
  };

  const loadCalendar = (loaded: { summary: NonNullable<Answers["calendar"]>; events: CalendarEvent[] }) => {
    setEvents(loaded.events);
    record({ calendar: loaded.summary }, false);
  };

  if (!started || step === undefined) {
    return (
      <Frame>
        <div className="max-w-2xl text-sky-ink">
          <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl">
            Check your own weather before you plan the day.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
            A few quick questions about sleep, food and how your head feels. Back comes a forecast for
            your energy, focus and mood, with plain advice for the hours ahead.
          </p>

          <div className="mt-8 max-w-xl">
            <p id="cycle-optin" className="text-lg">
              Factor in your cycle? <span className="text-base">Optional, and private to this browser.</span>
            </p>
            <div className="mt-2">
              <ChipGroup
                labelledBy="cycle-optin"
                options={[
                  { value: "yes", label: "Yes, include it" },
                  { value: "no", label: "No, skip it" },
                ]}
                value={settings === null && cycleChoice === null ? undefined : cycleEnabled ? "yes" : cycleChoice === false ? "no" : undefined}
                onSelect={(v) => chooseCycle(v === "yes")}
              />
            </div>
            {cycleEnabled && <p className="mt-2 text-base">Cycle info stays in this browser.</p>}
          </div>

          <button type="button" onClick={start} className={`${primaryButton} mt-8`}>
            Start check-in
          </button>
        </div>
      </Frame>
    );
  }

  if (step === "done" && report) {
    return (
      <ForecastReport
        report={report}
        recommendations={recommendations}
        result={result}
        now={now}
        suggestions={suggestions}
        streak={stats.streak}
        achievements={achievements}
        racing={answers.head === "racing"}
        supportNote={needsSupportNote(history, result.scores, now)}
        cycleNotes={answers.cycle ? cycleNotes(history, answers) : []}
        hasCycle={answers.cycle !== undefined}
        calendar={answers.calendar}
        onRemoveCalendar={removeCalendar}
        onRemoveCycle={removeCycle}
        onBack={back}
        onRestart={restart}
      />
    );
  }
  if (step === "done") return null;

  const progress = getProgress(answers, history, now, options);
  const position = path.filter((id) => id !== "final" && id !== "done" && id !== "calendar").length;
  const barPercent = step === "calendar" ? 0 : Math.min(100, Math.round((progress.answered / Math.max(1, progress.total)) * 100));
  const progressLabel =
    step === "calendar"
      ? "Optional first step"
      : step === "final"
        ? "Last step"
        : `Question ${position} of about ${Math.max(position, progress.total)}`;

  return (
    <Frame>
      <h1 className="sr-only">Burnout Weather Report: check-in</h1>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div className="text-sky-ink">
          <div className="max-w-2xl">
            <p className="font-mono text-sm">{progressLabel}</p>
            <div
              role="progressbar"
              aria-label="Check-in progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={barPercent}
              className="mt-2 h-px w-full bg-sky-ink/30"
            >
              <div
                className="h-px bg-sky-ink transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${barPercent}%` }}
              />
            </div>
          </div>

          {step === "calendar" ? (
            <CalendarStep
              key="calendar"
              summary={answers.calendar}
              useTitles={useTitles}
              onUseTitles={setUseTitles}
              onSample={() => loadCalendar(sampleCalendar(new Date()))}
              onIcs={(text) => {
                const read = readCalendar(text, new Date());
                if ("error" in read) return read.error;
                loadCalendar(read);
                return null;
              }}
              onSkip={() => goTo(answers, now)}
              onRemove={removeCalendar}
              onContinue={() => goTo(answers, now)}
              onBack={undefined}
              onRestart={restart}
            />
          ) : step === "final" ? (
            <FinalStep
              key="final"
              initial={answers.avoidPeople ?? false}
              onBack={path.length > 1 ? back : undefined}
              onRestart={restart}
              onSubmit={(avoidPeople) => record({ avoidPeople }, true)}
            />
          ) : (
            <QuestionStep
              key={step}
              id={step}
              answers={answers}
              history={history}
              now={now}
              onBack={path.length > 1 ? back : undefined}
              onRestart={restart}
              onChange={(updates, advance) => record(updates, advance)}
              onNext={() => goTo(answers, now)}
            />
          )}
        </div>

        {/* On a phone the readout sticks to the bottom of the screen so it is always in view. */}
        <div className="max-lg:sticky max-lg:bottom-0 max-lg:z-20 lg:sticky lg:top-6 lg:self-start">
          <div className="border border-hairline">
            <LiveReadout scores={result.scores} change={change} />
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-4 sm:px-8 sm:py-12 lg:py-20 max-lg:pb-0">
      {children}
    </div>
  );
}

type QuestionStepProps = {
  id: QuestionId;
  answers: Answers;
  history: SavedCheckIn[];
  now: Date;
  onBack?: () => void;
  onRestart: () => void;
  onChange: (updates: Partial<Answers>, advance: boolean) => void;
  onNext: () => void;
};

function QuestionStep({ id, answers, history, now, onBack, onRestart, onChange, onNext }: QuestionStepProps) {
  const question = QUESTION_BY_ID[id];
  const ctx = { answers, history, now };
  const fields = visibleFields(question, ctx);
  // Multi-select questions can be left empty ("none of these"), so they never block Next.
  const complete = fields.every((f) => f.multi || answers[f.key] !== undefined);
  const help = question.help?.(ctx);
  const single = question.kind === "choice";

  const next = () => {
    const unset = fields.filter((f) => f.multi && answers[f.key] === undefined);
    if (unset.length > 0) onChange(Object.fromEntries(unset.map((f) => [f.key, []])) as Partial<Answers>, true);
    else onNext();
  };

  return (
    <section aria-labelledby={`${id}-title`} className="mt-5 max-w-2xl sm:mt-8">
      <h2 id={`${id}-title`} className="text-2xl leading-tight font-normal text-balance sm:text-3xl lg:text-4xl">
        {question.text(ctx)}
      </h2>
      {help && <p className="mt-2 text-base text-pretty sm:mt-3 sm:text-lg">{help}</p>}

      <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
        {fields.map((field, index) => {
          const labelId = single || !field.label ? `${id}-title` : `${id}-${field.key}-label`;
          return (
            <div key={field.key}>
              {!single && field.label && (
                <p id={labelId} className="mb-1.5 text-base font-medium sm:mb-2">
                  {field.label}
                </p>
              )}
              {field.multi ? (
                <ChipMulti
                  labelledBy={labelId}
                  options={field.options}
                  value={answers[field.key] as string[] | undefined}
                  autoFocus={index === 0}
                  onChange={(values) => onChange({ [field.key]: values } as Partial<Answers>, false)}
                />
              ) : (
                <ChipGroup
                  labelledBy={labelId}
                  options={field.options}
                  value={answers[field.key] === undefined ? undefined : String(answers[field.key])}
                  autoFocus={index === 0}
                  onSelect={(value) => onChange({ [field.key]: value } as Partial<Answers>, single)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 sm:mt-8 sm:gap-y-3">
        {onBack && (
          <button type="button" onClick={onBack} className={textButton}>
            Back
          </button>
        )}
        <button type="button" onClick={onRestart} className={textButton}>
          Start over
        </button>
        {!single && (
          <button type="button" onClick={next} disabled={!complete} className={primaryButton}>
            Next
          </button>
        )}
        {question.skippable && (
          <button
            type="button"
            onClick={() => onChange({ [fields[0].key]: "skipped" } as Partial<Answers>, true)}
            className={textButton}
          >
            Skip this question
          </button>
        )}
      </div>
    </section>
  );
}

function FinalStep({
  initial,
  onBack,
  onRestart,
  onSubmit,
}: {
  initial: boolean;
  onBack?: () => void;
  onRestart: () => void;
  onSubmit: (avoidPeople: boolean) => void;
}) {
  const question = QUESTION_BY_ID.final;
  const [avoidPeople, setAvoidPeople] = useState(initial);
  const ctx = { answers: {}, history: [], now: EPOCH };

  return (
    <section aria-labelledby="final-title" className="mt-8 max-w-2xl">
      <h2 id="final-title" className="text-3xl leading-tight font-normal text-balance sm:text-4xl">
        {question.text(ctx)}
      </h2>
      <p className="mt-3 text-lg text-pretty">{question.help?.(ctx)}</p>

      <button
        type="button"
        role="switch"
        aria-checked={avoidPeople}
        onClick={() => setAvoidPeople((v) => !v)}
        autoFocus
        className={`mt-6 flex min-h-14 w-full items-center justify-between gap-4 border px-5 py-3 text-left text-lg transition-colors ${
          avoidPeople ? "border-isobar bg-low-sun text-isobar" : "border-hairline bg-ground text-ink hover:border-ink"
        }`}
      >
        <span>I&apos;d rather not talk to people today</span>
        <span className="font-mono text-sm">{avoidPeople ? "On" : "Off"}</span>
      </button>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {onBack && (
          <button type="button" onClick={onBack} className={textButton}>
            Back
          </button>
        )}
        <button type="button" onClick={onRestart} className={textButton}>
          Start over
        </button>
        <button type="button" onClick={() => onSubmit(avoidPeople)} className={primaryButton}>
          Get my forecast
        </button>
      </div>
    </section>
  );
}
