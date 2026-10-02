import { describe, expect, it } from "vitest";
import { computeScores } from "./forecast";
import {
  MAX_QUESTIONS,
  consecutiveDaysBefore,
  getNextQuestion,
  getProgress,
  pruneAnswers,
  QUESTIONS,
  type QuestionId,
  visibleFields,
} from "./questions";
import { describeChange } from "./readout";
import type { Answers, CheckIn } from "./types";

const at = (hour: number, minute = 0) => new Date(2026, 9, 3, hour, minute);

const nextId = (answers: Answers, history: CheckIn[] = [], now = at(9)): QuestionId | "done" => {
  const next = getNextQuestion(answers, history, now);
  return next === "done" ? "done" : next.id;
};

const checkIn = (daysAgo: number, overrides: Partial<CheckIn> = {}): CheckIn => ({
  date: new Date(2026, 9, 3 - daysAgo, 9).toISOString(),
  answers: {},
  scores: { energy: 60, focus: 60, mood: 60, social: 60, pressure: 30 },
  crash: 10,
  ...overrides,
});

const lowMood = (daysAgo: number) =>
  checkIn(daysAgo, { scores: { energy: 50, focus: 50, mood: 25, social: 50, pressure: 40 } });
const shortSleep = (daysAgo: number) => checkIn(daysAgo, { answers: { sleep: "under5" } });

/** Answers each question with its first option until the check-in is finished. */
function runThrough(
  pick: (id: QuestionId, values: string[]) => string | undefined,
  start: Answers = {},
  history: CheckIn[] = [],
  now = at(9),
) {
  let answers = start;
  const asked: QuestionId[] = [];
  for (let step = 0; step < 40; step++) {
    const next = getNextQuestion(answers, history, now);
    if (next === "done") break;
    asked.push(next.id);
    if (next.kind === "final") {
      answers = { ...answers, avoidPeople: false };
      continue;
    }
    // Fields can appear as others are answered (caffeine timing), so re-read them each time.
    for (let guard = 0; guard < 5; guard++) {
      const field = visibleFields(next, { answers, history, now }).find((f) => answers[f.key] === undefined);
      if (!field) break;
      const value = pick(next.id, field.options.map((o) => o.value)) ?? field.options[0].value;
      answers = { ...answers, [field.key]: value } as Answers;
    }
  }
  return { answers, asked };
}

describe("getNextQuestion", () => {
  it("starts with the kind of day, then sleep", () => {
    expect(nextId({})).toBe("profile");
    expect(nextId({ profile: "desk" })).toBe("sleep");
  });

  it("skips the wake-up question after 8+ hours of sleep", () => {
    expect(nextId({ profile: "desk", sleep: "8plus" })).toBe("lastMeal");
    expect(nextId({ profile: "desk", sleep: "7to8" })).toBe("wake");
  });

  it("skips the meal question when nothing has been eaten", () => {
    expect(nextId({ profile: "desk", sleep: "8plus", lastMeal: "nothingYet" }, [], at(10))).toBe("waterCaffeine");
    expect(nextId({ profile: "desk", sleep: "8plus", lastMeal: "6hplus" })).toBe("mealType");
  });

  it("asks whether they can eat soon only when nothing is eaten after 2 PM", () => {
    const answers: Answers = { profile: "desk", sleep: "8plus", lastMeal: "nothingYet" };
    expect(nextId(answers, [], at(14, 30))).toBe("canEat");
    expect(nextId(answers, [], at(13, 59))).toBe("waterCaffeine");
  });

  it("asks about pain after a hard or brutal session, and not otherwise", () => {
    const base: Answers = {
      profile: "training", sleep: "8plus", lastMeal: "within2h", mealType: "balanced",
      water: "4plus", caffeine: "none", movement: "today",
    };
    expect(nextId({ ...base, training: "brutal" })).toBe("pain");
    expect(nextId({ ...base, training: "hard" })).toBe("pain");
    expect(nextId({ ...base, training: "easy" })).toBe("head");
  });

  it("asks what a racing head is racing about", () => {
    const base: Answers = {
      profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced",
      water: "4plus", caffeine: "none", movement: "today", meetings: "0",
    };
    expect(nextId({ ...base, head: "racing" })).toBe("racingAbout");
    expect(nextId({ ...base, head: "clear" })).toBe("final");
  });

  it("uses the question for the chosen profile", () => {
    const base: Answers = {
      sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "4plus", caffeine: "none", movement: "today",
    };
    expect(nextId({ ...base, profile: "desk" })).toBe("meetings");
    expect(nextId({ ...base, profile: "study" })).toBe("deadlines");
    expect(nextId({ ...base, profile: "training" })).toBe("training");
  });

  it("waits for the caffeine timing when there was caffeine", () => {
    const base: Answers = { profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "1to3" };
    expect(nextId({ ...base, caffeine: "2" })).toBe("waterCaffeine");
    expect(nextId({ ...base, caffeine: "2", caffeineTiming: "beforeNoon" })).toBe("movement");
    expect(nextId({ ...base, caffeine: "none" })).toBe("movement");
  });

  it("asks the jitters question for 3+ cups, and the blocker question after 2+ days without moving", () => {
    const base: Answers = {
      profile: "study", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "1to3",
      caffeine: "3plus", caffeineTiming: "beforeNoon",
    };
    expect(nextId(base)).toBe("jittery");
    expect(nextId({ ...base, jittery: "no", movement: "cantRemember" })).toBe("movementBlocker");
  });

  it("asks the desk and study follow-ups for heavy workloads", () => {
    const base: Answers = {
      sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "1to3", caffeine: "none", movement: "today",
    };
    expect(nextId({ ...base, profile: "desk", meetings: "6plus" })).toBe("gaps");
    expect(nextId({ ...base, profile: "desk", meetings: "6plus", gaps: "yes" })).toBe("skippable");
    expect(nextId({ ...base, profile: "study", deadlines: "3plus" })).toBe("firstDeadline");
  });

  it("asks about sleep after a very short night, unless short sleep is already a pattern", () => {
    const answers: Answers = { profile: "desk", sleep: "under5", wake: "groggy" };
    expect(nextId(answers)).toBe("sleepNights");
    const history = [shortSleep(1)];
    expect(nextId({ profile: "desk", sleep: "under5" }, history)).toBe("sleepBlocker");
    expect(nextId(answers, history)).toBe("sleepBlocker");
  });

  it("references the sleep streak in the question text", () => {
    const next = getNextQuestion({ profile: "desk", sleep: "5to6" }, [shortSleep(1), shortSleep(2)], at(9));
    expect(next).not.toBe("done");
    if (next !== "done") {
      expect(next.text({ answers: { profile: "desk", sleep: "5to6" }, history: [shortSleep(1), shortSleep(2)], now: at(9) })).toBe(
        "Sleep has been short for 3 days. What's getting in the way?",
      );
    }
  });

  it("asks the optional weighing question after 3+ low-mood days in a row, never after a gap", () => {
    const answered: Answers = {
      profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "1to3", caffeine: "none",
      movement: "today", meetings: "0", head: "clear",
    };
    expect(nextId(answered, [lowMood(1), lowMood(2), lowMood(3)])).toBe("weighing");
    expect(nextId(answered, [lowMood(1), lowMood(2)])).toBe("final");
    expect(nextId(answered, [lowMood(1), lowMood(3), lowMood(4)])).toBe("final");
    expect(nextId({ ...answered, weighing: "skipped" }, [lowMood(1), lowMood(2), lowMood(3)])).toBe("final");
  });

  it("asks about tomorrow and screens in the evening only", () => {
    const answered: Answers = {
      profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "1to3", caffeine: "none",
      movement: "today", meetings: "0", head: "clear",
    };
    expect(nextId(answered, [], at(20))).toBe("tomorrow");
    expect(nextId({ ...answered, tomorrow: "light" }, [], at(20))).toBe("screens");
    expect(nextId(answered, [], at(9))).toBe("final");
  });

  it("never mentions breakfast in the evening", () => {
    const { asked } = runThrough(() => undefined, {}, [], at(20));
    expect(asked.length).toBeGreaterThan(0);
    for (const q of QUESTIONS) {
      const ctx = { answers: { profile: "desk" as const }, history: [], now: at(20) };
      const copy = [q.text(ctx), q.help?.(ctx) ?? "", ...q.fields(ctx).flatMap((f) => f.options.map((o) => `${o.label} ${o.hint ?? ""}`))];
      expect(copy.join(" ").toLowerCase()).not.toContain("breakfast");
    }
  });

  it("ends with the final screen, then reports done", () => {
    const { answers, asked } = runThrough(() => undefined);
    expect(asked[asked.length - 1]).toBe("final");
    expect(getNextQuestion(answers, [], at(9))).toBe("done");
  });

  it("asks between 5 and 11 questions, even when every follow-up is triggered", () => {
    const worst = runThrough(
      (id, values) => {
        const pick: Partial<Record<QuestionId, string>> = {
          profile: "desk", sleep: "under5", lastMeal: "nothingYet", movement: "cantRemember", meetings: "6plus",
          head: "racing",
        };
        return pick[id] ?? values[values.length - 1];
      },
      {},
      [shortSleep(1), lowMood(1), lowMood(2), lowMood(3)],
      at(20),
    );
    const best = runThrough((id, values) => (id === "profile" ? "desk" : values[0]), {}, [], at(9));
    for (const run of [worst, best]) {
      const questions = run.asked.filter((id) => id !== "final").length;
      expect(questions, run.asked.join(",")).toBeGreaterThanOrEqual(5);
      expect(questions, run.asked.join(",")).toBeLessThanOrEqual(MAX_QUESTIONS);
    }
    // Safety follow-ups still make it in when the budget is tight.
    const brutal = runThrough(
      (id, values) => ({ profile: "training", training: "brutal", sleep: "under5", head: "racing", movement: "cantRemember" } as Record<string, string>)[id] ?? values[0],
      {},
      [],
      at(9),
    );
    expect(brutal.asked).toContain("pain");
    expect(brutal.asked.filter((id) => id !== "final").length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it("re-evaluates after every answer: changing an answer drops follow-ups that no longer apply", () => {
    const before: Answers = { profile: "desk", sleep: "5to6", wake: "groggy", lastMeal: "nothingYet", mealType: "coffee" };
    const after = pruneAnswers({ ...before, sleep: "8plus", lastMeal: "6hplus" }, [], at(9));
    expect(after.wake).toBeUndefined();
    expect(after.mealType).toBe("coffee");
    const prunedMeal = pruneAnswers({ ...before, lastMeal: "nothingYet" }, [], at(9));
    expect(prunedMeal.mealType).toBeUndefined();
    expect(pruneAnswers({ profile: "study", meetings: "3to5", caffeine: "none", caffeineTiming: "afterNoon" }, [], at(9))).toEqual({
      profile: "study",
      caffeine: "none",
    });
  });

  it("estimates progress that never runs past the cap", () => {
    expect(getProgress({}, [], at(9)).answered).toBe(0);
    const { total } = getProgress({ profile: "desk" }, [], at(9));
    expect(total).toBeGreaterThanOrEqual(7);
    expect(total).toBeLessThanOrEqual(MAX_QUESTIONS);
  });
});

describe("consecutiveDaysBefore", () => {
  it("counts days back from yesterday and ignores today", () => {
    expect(consecutiveDaysBefore([lowMood(0), lowMood(1), lowMood(2)], at(9), () => true)).toBe(2);
  });
});

describe("describeChange", () => {
  it("names the rule behind the latest answer and the points it moved", () => {
    const before = computeScores({ profile: "desk" }, [], at(9));
    const after = computeScores({ profile: "desk", sleep: "under5" }, [], at(9));
    const change = describeChange(before, after);
    expect(change.deltas.energy).toBe(-16);
    expect(change.reasons).toEqual(["Slept under 5 hours: energy -16, focus -14, mood -6, pressure +12"]);
  });

  it("reports nothing when an answer changes no scores", () => {
    const before = computeScores({}, [], at(9));
    const after = computeScores({ sleep: "7to8" }, [], at(9));
    expect(describeChange(before, after)).toEqual({
      deltas: { energy: 0, focus: 0, mood: 0, social: 0, pressure: 0 },
      reasons: [],
    });
  });
});
