import { describe, expect, it } from "vitest";
import { CYCLE_EXTRA_QUESTIONS, MAX_QUESTIONS, getNextQuestion, getProgress, pruneAnswers, visibleFields, type QuestionId } from "./questions";
import type { Answers } from "./types";

const now = new Date(2026, 9, 3, 9, 0);
const CYCLE_IDS: QuestionId[] = ["cycle", "flow", "cramps", "noticing"];

/** Answers every question the way `pick` says (or the first option) until the check-in ends. */
function run(
  options: { cycle?: boolean },
  pick: (id: QuestionId, values: string[]) => string | string[] | undefined = () => undefined,
  start: Answers = {},
) {
  let answers = start;
  const asked: QuestionId[] = [];
  for (let step = 0; step < 40; step++) {
    const next = getNextQuestion(answers, [], now, options);
    if (next === "done") break;
    asked.push(next.id);
    if (next.kind === "final") {
      answers = { ...answers, avoidPeople: false };
      continue;
    }
    for (let guard = 0; guard < 6; guard++) {
      const field = visibleFields(next, { answers, history: [], now }).find((f) => answers[f.key] === undefined);
      if (!field) break;
      const values = field.options.map((o) => o.value);
      const chosen = pick(next.id, values) ?? (field.multi ? [] : values[0]);
      answers = { ...answers, [field.key]: chosen } as Answers;
    }
  }
  return { answers, asked };
}

const desk = (id: QuestionId, values: string[]) => (id === "profile" ? "desk" : undefined) ?? values[0];

describe("cycle questions are opt-in", () => {
  it("never appear when the feature is off, whatever the answers are", () => {
    for (const profile of ["desk", "study", "training"]) {
      const { asked } = run({}, (id, v) => (id === "profile" ? profile : v[0]));
      expect(asked.filter((id) => CYCLE_IDS.includes(id))).toEqual([]);
    }
    expect(run({ cycle: false }).asked.filter((id) => CYCLE_IDS.includes(id))).toEqual([]);
  });

  it("drop any cycle answers already held when the feature is switched off", () => {
    const held: Answers = { profile: "desk", cycle: "period", flow: "heavy", cramps: "strong" };
    const pruned = pruneAnswers(held, [], now, {});
    expect(pruned).toEqual({ profile: "desk" });
    expect(pruneAnswers(held, [], now, { cycle: true })).toEqual(held);
  });

  it("ask where they are in their cycle, with the four options, once it is on", () => {
    const { asked } = run({ cycle: true }, desk);
    expect(asked).toContain("cycle");
    const question = getNextQuestion({ profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "1to3", caffeine: "none", movement: "today", meetings: "0" }, [], now, { cycle: true });
    expect(question).not.toBe("done");
    if (question !== "done") {
      expect(question.id).toBe("cycle");
      expect(question.text({ answers: {}, history: [], now })).toBe("Where are you in your cycle?");
      expect(question.fields({ answers: {}, history: [], now })[0].options.map((o) => o.label)).toEqual([
        "On my period",
        "Just before my period",
        "Between periods",
        "Not sure or not applicable today",
      ]);
    }
  });
});

describe("cycle follow-ups", () => {
  const pickCycle = (phase: string) => (id: QuestionId, values: string[]) => (id === "cycle" ? phase : id === "profile" ? "desk" : values[0]);

  it("on a period: asks about flow, then cramps or pain", () => {
    const { asked, answers } = run({ cycle: true }, (id, v) => (id === "flow" ? "heavy" : id === "cramps" ? "strong" : pickCycle("period")(id, v)));
    expect(asked).toContain("flow");
    expect(asked).toContain("cramps");
    expect(asked).not.toContain("noticing");
    expect(asked.indexOf("flow")).toBeLessThan(asked.indexOf("cramps"));
    expect(answers).toMatchObject({ cycle: "period", flow: "heavy", cramps: "strong" });
  });

  it("before a period: asks what they are noticing, as a multi-select", () => {
    const { asked, answers } = run({ cycle: true }, (id, v) => (id === "noticing" ? ["mood", "cravings"] : pickCycle("pms")(id, v)));
    expect(asked).toContain("noticing");
    expect(asked).not.toContain("flow");
    expect(asked).not.toContain("cramps");
    expect(answers.noticing).toEqual(["mood", "cravings"]);
  });

  it("asks nothing more when between periods or not sure", () => {
    for (const phase of ["between", "unsure"]) {
      const { asked } = run({ cycle: true }, pickCycle(phase));
      expect(asked).toContain("cycle");
      expect(asked.filter((id) => ["flow", "cramps", "noticing"].includes(id))).toEqual([]);
    }
  });

  it("changing the answer drops the follow-ups that no longer apply", () => {
    const before: Answers = { profile: "desk", cycle: "period", flow: "heavy", cramps: "strong" };
    expect(pruneAnswers({ ...before, cycle: "between" }, [], now, { cycle: true })).toEqual({ profile: "desk", cycle: "between" });
    expect(pruneAnswers({ ...before, cycle: "pms" }, [], now, { cycle: true })).toEqual({ profile: "desk", cycle: "pms" });
  });

  it("stays within the question limit even with every follow-up", () => {
    const worst = run({ cycle: true }, (id, v) => (id === "cycle" ? "period" : id === "profile" ? "training" : id === "training" ? "brutal" : id === "sleep" ? "under5" : id === "head" ? "racing" : id === "movement" ? "cantRemember" : v[0]));
    expect(worst.asked.filter((id) => id !== "final").length).toBeLessThanOrEqual(MAX_QUESTIONS + CYCLE_EXTRA_QUESTIONS);
    expect(worst.asked).toContain("flow");
    expect(worst.asked).toContain("pain");
    const progress = getProgress({ profile: "desk" }, [], now, { cycle: true });
    expect(progress.total).toBeLessThanOrEqual(MAX_QUESTIONS + CYCLE_EXTRA_QUESTIONS);
    // Without the cycle the limit is unchanged.
    expect(getProgress({ profile: "desk" }, [], now).total).toBeLessThanOrEqual(MAX_QUESTIONS);
  });
});
