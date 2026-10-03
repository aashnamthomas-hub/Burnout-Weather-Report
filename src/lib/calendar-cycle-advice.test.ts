import { describe, expect, it } from "vitest";
import { sampleCalendar } from "./calendar";
import { computeScores } from "./forecast";
import { LIBRARY, pickRecommendations, type EventNote } from "./recommendations";
import { isGoodDay, modeFor } from "./report";
import { CYCLE_NOTES, cycleNotes } from "./safety";
import type { Answers, CheckIn } from "./types";

const day = new Date(2026, 9, 3);
const at = (hour: number, minute = 0) => new Date(2026, 9, 3, hour, minute);

function recsFor(answers: Answers, now: Date, titles?: EventNote[]) {
  const r = computeScores(answers, [], now);
  return pickRecommendations({
    a: answers,
    r,
    hour: now.getHours(),
    minutes: now.getHours() * 60 + now.getMinutes(),
    mode: modeFor(now),
    good: isGoodDay(r),
    titles,
  });
}

const { summary: sample, events: sampleEvents } = sampleCalendar(day);
const DESK: Answers = {
  profile: "desk", sleep: "6to7", wake: "okay", lastMeal: "4to6h", mealType: "carbs", water: "1to3",
  caffeine: "1", caffeineTiming: "beforeNoon", movement: "yesterday", head: "busy", calendar: sample, meetings: "6plus",
};

describe("calendar-aware recommendations", () => {
  it("names the actual gap to eat in", () => {
    const eat = recsFor(DESK, at(11, 30)).find((p) => p.id === "cal-eat-gap");
    expect(eat?.text).toContain("12:00 PM to 12:30 PM");
    expect(recsFor(DESK, at(11, 30)).map((p) => p.id)).not.toContain("food-eat-now");
  });

  it("names the actual gap to walk in when there are many meetings", () => {
    const ids = recsFor({ ...DESK, lastMeal: "within2h", mealType: "balanced" }, at(9, 0));
    const walk = ids.find((p) => p.id === "cal-walk-gap");
    expect(walk?.text).toContain("Walk 10 minutes in your gap from");
    expect(walk?.reason).toContain("6 meetings");
  });

  it("moves on to the next gap once one is over", () => {
    const afternoon = recsFor({ ...DESK, lastMeal: "6hplus" }, at(13, 30)).find((p) => p.id === "cal-eat-gap");
    expect(afternoon?.text).toContain("1:00 PM to 2:00 PM");
  });

  it("flags a back-to-back run that overlaps the predicted dip", () => {
    const rough: Answers = { ...DESK, sleep: "5to6", lastMeal: "6hplus", mealType: "coffee" };
    const result = computeScores(rough, [], at(10));
    expect(result.crash).toBeGreaterThanOrEqual(60); // dip lands near 1 to 2 PM, next to the 2 PM run
    const flagged = recsFor(rough, at(10)).find((p) => p.id === "cal-b2b-crash");
    expect(flagged?.text).toContain("2:00 PM to 4:15 PM");
    expect(flagged?.reason).toContain("Crash risk is");
  });

  it("does not flag the run when it is clear of the dip", () => {
    const calm: Answers = { ...DESK, sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "4plus", movement: "today", head: "clear" };
    expect(recsFor(calm, at(10)).map((p) => p.id)).not.toContain("cal-b2b-crash");
  });

  it("points out a free morning window before the first meeting", () => {
    const early: Answers = { ...DESK, lastMeal: "within2h", mealType: "balanced", calendar: { ...sample, firstStart: 11 * 60, freeBeforeFirst: 120 } };
    const tip = recsFor(early, at(8, 30)).find((p) => p.id === "cal-free-morning");
    expect(tip?.text).toBe("You are free until 11:00 AM. Use that window for your hardest task.");
  });

  it("only uses event titles when they are provided", () => {
    const titles: EventNote[] = sampleEvents.map((e) => ({ title: e.title!, start: e.start.getHours() * 60 + e.start.getMinutes(), end: e.end.getHours() * 60 + e.end.getMinutes() }));
    const without = recsFor({ ...DESK, lastMeal: "within2h", mealType: "balanced", water: "4plus", sleep: "8plus", head: "clear", movement: "today" }, at(9), undefined);
    expect(without.map((p) => p.text).join(" ")).not.toContain("Design review");
    const withTitles = recsFor({ ...DESK, lastMeal: "within2h", mealType: "balanced", water: "4plus", sleep: "8plus", head: "clear", movement: "today" }, at(9), titles);
    expect(withTitles.map((p) => p.text).join(" ")).toContain('"Design review" at 12:30 PM');
  });
});

describe("cycle recommendations", () => {
  const base: Answers = { profile: "desk", sleep: "7to8", lastMeal: "within2h", mealType: "balanced", water: "4plus", caffeine: "none", movement: "today", head: "clear", meetings: "0" };

  it("suggests heat and rest for strong pain, using supportive wording", () => {
    const picks = recsFor({ ...base, cycle: "period", cramps: "strong" }, at(9));
    expect(picks[0].id).toBe("cycle-heat-rest");
    expect(picks[0].text).toMatch(/^Many people find a heat pack and some rest/);
  });

  it("suggests iron-rich foods for a heavy flow", () => {
    const text = recsFor({ ...base, cycle: "period", flow: "heavy" }, at(9)).map((p) => p.text).join(" ");
    for (const food of ["dal", "spinach", "rajma", "chana", "jaggery", "eggs"]) expect(text).toContain(food);
    expect(text).toContain("Many people find");
  });

  it("says go by how you feel for training, and regular meals and a stop time for study", () => {
    const training = recsFor({ ...base, profile: "training", training: "easy", cycle: "pms" }, at(9)).map((p) => p.text).join(" ");
    expect(training).toContain("Go by how you feel");
    const study = recsFor({ ...base, profile: "study", cycle: "period", deadlines: "none", sleep: "5to6" }, at(9)).map((p) => p.text).join(" ");
    expect(study).toMatch(/regular meals and a firm stop time/);
  });

  it("never frames a lighter day as weakness, and never diagnoses", () => {
    const answers: Answers[] = [
      { ...base, cycle: "period", flow: "heavy", cramps: "strong", sleep: "5to6", head: "flat" },
      { ...base, cycle: "pms", noticing: ["mood", "cravings", "bloating", "sleep"] },
    ];
    for (const a of answers) {
      const text = recsFor(a, at(9)).map((p) => `${p.text} ${p.reason}`).join(" ").toLowerCase();
      for (const bad of ["weak", "lazy", "give up", "diagnos", "disorder", "pcos", "endometriosis", "ovulat", "fertil", "pregnan"]) {
        expect(text).not.toContain(bad);
      }
    }
  });

  it("answers each pms follow-up: cravings, sleep, bloating, mood", () => {
    const answers: Answers = { ...base, cycle: "pms", noticing: ["cravings", "sleep", "bloating", "mood"] };
    const r = computeScores(answers, [], at(20));
    const ctx = { a: answers, r, hour: 20, mode: modeFor(at(20)), good: false };
    for (const id of ["cycle-cravings", "cycle-sleep", "cycle-bloating", "cycle-mood"]) {
      const rec = LIBRARY.find((x) => x.id === id)!;
      expect(rec.trigger(ctx)).toBe(true);
      expect(rec.text(ctx)).toMatch(/^Many people find|^Mood dips around now are common for many people/);
    }
    const without = { ...ctx, a: { ...answers, noticing: ["nothing" as const] } };
    for (const id of ["cycle-cravings", "cycle-sleep", "cycle-bloating", "cycle-mood"]) {
      expect(LIBRARY.find((x) => x.id === id)!.trigger(without)).toBe(false);
    }
  });

  it("gives no cycle advice when there are no cycle answers", () => {
    const ids = recsFor(base, at(9)).map((p) => p.id);
    expect(ids.filter((id) => id.startsWith("cycle-"))).toEqual([]);
  });
});

describe("cycleNotes (when to gently mention a doctor)", () => {
  const earlier = (flow?: string, cramps?: string, daysAgo = 1): CheckIn => ({
    date: new Date(2026, 9, 3 - daysAgo, 9).toISOString(),
    answers: { flow, cramps } as Answers,
    scores: { energy: 50, focus: 50, mood: 50, social: 50, pressure: 40 },
    crash: 20,
  });

  it("says nothing for ordinary answers", () => {
    expect(cycleNotes([earlier("light"), earlier("medium", "mild", 2)], { flow: "medium", cramps: "mild" })).toEqual([]);
  });

  it("includes the exact line whenever pain is strong", () => {
    expect(cycleNotes([], { cramps: "strong" })).toEqual([CYCLE_NOTES.strongPain]);
    expect(CYCLE_NOTES.strongPain).toBe("Severe or worsening period pain is worth checking with a doctor.");
  });

  it("suggests mentioning heavy flow after three heavy check-ins in a row", () => {
    expect(cycleNotes([earlier("heavy", undefined, 2), earlier("heavy", undefined, 1)], { flow: "heavy" })).toContain(CYCLE_NOTES.heavyFlow);
    expect(cycleNotes([earlier("heavy", undefined, 1)], { flow: "heavy" })).not.toContain(CYCLE_NOTES.heavyFlow);
    expect(cycleNotes([earlier("heavy", undefined, 2), earlier("light", undefined, 1)], { flow: "heavy" })).not.toContain(CYCLE_NOTES.heavyFlow);
  });

  it("notices strong pain coming up repeatedly", () => {
    const history = [earlier("medium", "strong", 4), earlier("medium", "mild", 3), earlier("medium", "strong", 2)];
    const notes = cycleNotes(history, { flow: "medium", cramps: "strong" });
    expect(notes).toEqual([CYCLE_NOTES.strongPain, CYCLE_NOTES.repeatedPain]);
  });

  it("is gentle: no diagnosis words", () => {
    const text = Object.values(CYCLE_NOTES).join(" ").toLowerCase();
    for (const word of ["diagnos", "disorder", "condition", "endometriosis", "pcos"]) expect(text).not.toContain(word);
  });
});
