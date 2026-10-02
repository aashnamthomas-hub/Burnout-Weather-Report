"use client";

import { useEffect, useMemo, useState } from "react";
import { computeScores } from "@/lib/forecast";
import {
  QUESTION_BY_ID,
  getNextQuestion,
  getProgress,
  isAnswered,
  pruneAnswers,
  visibleFields,
  type QuestionId,
} from "@/lib/questions";
import { describeChange } from "@/lib/readout";
import { readStorage } from "@/lib/storage";
import type { Answers, CheckIn as SavedCheckIn } from "@/lib/types";
import { ChipGroup } from "./ChipGroup";
import { LiveReadout } from "./LiveReadout";
import { useSky } from "./SkyProvider";

type Step = QuestionId | "done";

const EPOCH = new Date(0);

const primaryButton =
  "border border-isobar bg-low-sun px-6 py-3 text-lg text-isobar transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const textButton =
  "text-base text-sky-ink underline underline-offset-4 decoration-from-font hover:no-underline";

export function CheckIn() {
  const { setSky } = useSky();
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState<Date>(EPOCH);
  const [history, setHistory] = useState<SavedCheckIn[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [before, setBefore] = useState<Answers | null>(null);
  const [path, setPath] = useState<Step[]>([]);

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

  const goTo = (nextAnswers: Answers, clock: Date) => {
    const next = getNextQuestion(nextAnswers, history, clock);
    setPath((p) => [...p, next === "done" ? "done" : next.id]);
  };

  const start = () => {
    const clock = new Date();
    // Past check-ins are read when the check-in starts, never during server rendering.
    const saved = readStorage("checkIns");
    const past = Array.isArray(saved) ? saved : [];
    setHistory(past);
    setNow(clock);
    setStarted(true);
    const next = getNextQuestion({}, past, clock);
    setPath([next === "done" ? "done" : next.id]);
  };

  const restart = () => {
    setAnswers({});
    setBefore(null);
    setPath([]);
    setStarted(false);
    setNow(EPOCH);
  };

  const back = () => setPath((p) => p.slice(0, -1));

  /** Records one answer, re-scores, and drops follow-up answers that no longer apply. */
  const record = (updates: Partial<Answers>, advance: boolean) => {
    const clock = new Date();
    const next = pruneAnswers({ ...answers, ...updates }, history, clock);
    setBefore(answers);
    setAnswers(next);
    setNow(clock);
    if (advance) goTo(next, clock);
  };

  if (!started || step === undefined) {
    return (
      <div className="max-w-2xl text-sky-ink">
        <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl">
          Check your own weather before you plan the day.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
          A few quick questions about sleep, food and how your head feels. Back comes a forecast for
          your energy, focus and mood, with plain advice for the hours ahead.
        </p>
        <button type="button" onClick={start} className={`${primaryButton} mt-8`}>
          Start check-in
        </button>
      </div>
    );
  }

  const progress = getProgress(answers, history, now);
  const position = path.filter((id) => id !== "final" && id !== "done").length;
  const barPercent = Math.min(100, Math.round((progress.answered / Math.max(1, progress.total)) * 100));
  const progressLabel =
    step === "final"
      ? "Last step"
      : step === "done"
        ? "All done"
        : `Question ${position} of about ${Math.max(position, progress.total)}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
      <div className="text-sky-ink">
        <div className="max-w-2xl">
          <p className="font-mono text-sm">{progressLabel}</p>
          <div
            role="progressbar"
            aria-label="Check-in progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={step === "done" ? 100 : barPercent}
            className="mt-2 h-px w-full bg-sky-ink/30"
          >
            <div
              className="h-px bg-sky-ink transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${step === "done" ? 100 : barPercent}%` }}
            />
          </div>
        </div>

        {step === "done" ? (
          <DoneStep key="done" onBack={back} onRestart={restart} />
        ) : step === "final" ? (
          <FinalStep
            key="final"
            initial={answers.avoidPeople ?? false}
            onBack={path.length > 1 ? back : undefined}
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
            onChange={(updates, advance) => record(updates, advance)}
            onNext={() => goTo(answers, now)}
          />
        )}

        {step !== "done" && (
          <button type="button" onClick={restart} className={`${textButton} mt-10 block`}>
            Start over
          </button>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="border border-hairline">
          <LiveReadout scores={result.scores} change={change} />
        </div>
      </div>
    </div>
  );
}

type QuestionStepProps = {
  id: QuestionId;
  answers: Answers;
  history: SavedCheckIn[];
  now: Date;
  onBack?: () => void;
  onChange: (updates: Partial<Answers>, advance: boolean) => void;
  onNext: () => void;
};

function QuestionStep({ id, answers, history, now, onBack, onChange, onNext }: QuestionStepProps) {
  const question = QUESTION_BY_ID[id];
  const ctx = { answers, history, now };
  const fields = visibleFields(question, ctx);
  const complete = isAnswered(question, ctx);
  const help = question.help?.(ctx);
  const single = question.kind === "choice";

  return (
    <section aria-labelledby={`${id}-title`} className="mt-8 max-w-2xl">
      <h2 id={`${id}-title`} className="text-3xl leading-tight font-normal text-balance sm:text-4xl">
        {question.text(ctx)}
      </h2>
      {help && <p className="mt-3 text-lg text-pretty">{help}</p>}

      <div className="mt-6 space-y-6">
        {fields.map((field, index) => {
          const labelId = single ? `${id}-title` : `${id}-${field.key}-label`;
          return (
            <div key={field.key}>
              {!single && (
                <p id={labelId} className="mb-2 text-base font-medium">
                  {field.label}
                </p>
              )}
              <ChipGroup
                labelledBy={labelId}
                options={field.options}
                value={answers[field.key] === undefined ? undefined : String(answers[field.key])}
                autoFocus={index === 0}
                onSelect={(value) => onChange({ [field.key]: value } as Partial<Answers>, single)}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {onBack && (
          <button type="button" onClick={onBack} className={textButton}>
            Back
          </button>
        )}
        {!single && (
          <button type="button" onClick={onNext} disabled={!complete} className={primaryButton}>
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
  onSubmit,
}: {
  initial: boolean;
  onBack?: () => void;
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
        <button type="button" onClick={() => onSubmit(avoidPeople)} className={primaryButton}>
          Get my forecast
        </button>
      </div>
    </section>
  );
}

function DoneStep({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
  return (
    <section aria-labelledby="done-title" className="mt-8 max-w-2xl">
      <h2 id="done-title" tabIndex={-1} className="text-3xl leading-tight font-normal text-balance sm:text-4xl">
        That&apos;s everything. Your sky is set.
      </h2>
      <p className="mt-3 text-lg text-pretty">
        The numbers beside this are where your answers landed. Change an answer and they move again.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" onClick={onBack} className={textButton}>
          Back
        </button>
        <button type="button" onClick={onRestart} className={primaryButton}>
          Start over
        </button>
      </div>
    </section>
  );
}
