import { describe, expect, it } from "vitest";
import { computeScores } from "./forecast";
import { buildReport, dipCentre } from "./report";
import type { Answers } from "./types";

const at = (hour: number, minute = 0) => new Date(2026, 9, 3, hour, minute);

const reportFor = (answers: Answers, now: Date) =>
  buildReport(answers, computeScores(answers, [], now), 0, now);

const GOOD: Answers = {
  profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "4plus",
  caffeine: "1", caffeineTiming: "beforeNoon", movement: "today", meetings: "0", head: "clear",
};

const ROUGH: Answers = {
  profile: "desk", sleep: "under5", wake: "wrecked", lastMeal: "6hplus", mealType: "coffee",
  water: "none", caffeine: "3plus", caffeineTiming: "afterNoon", movement: "cantRemember",
  meetings: "6plus", head: "foggy",
};

describe("buildReport", () => {
  it("calls a good morning clear and protective", () => {
    const report = reportFor(GOOD, at(9));
    expect(report.good).toBe(true);
    expect(report.headline).toBe("Clear skies. Protect your morning.");
    expect(report.stormWarning).toBeNull();
  });

  it("writes a weather headline with the crash chance and hour when conditions are poor", () => {
    const answers: Answers = { ...GOOD, sleep: "5to6", wake: "groggy", lastMeal: "4to6h", mealType: "carbs", head: "foggy" };
    const result = computeScores(answers, [], at(9));
    const report = buildReport(answers, result, 0, at(9));
    expect(report.headline).toMatch(/^Foggy( and \w+)? morning, \d+% chance of a \d+ (AM|PM) crash$/);
    expect(report.headline).toContain(`${result.crash}%`);
  });

  it("uses a different headline in the afternoon and in the evening", () => {
    expect(reportFor(GOOD, at(14)).headline).toBe("Clear skies. Keep the afternoon steady.");
    expect(reportFor(GOOD, at(20)).headline).toBe("Clear skies tonight. Protect your sleep.");
    expect(reportFor({ ...ROUGH, tomorrow: "packed" }, at(20)).headline).toMatch(/evening, tomorrow looks heavy$/);
  });

  it("moves the dip earlier as the crash probability rises", () => {
    expect(dipCentre(10)).toBeGreaterThan(dipCentre(50));
    expect(dipCentre(50)).toBeGreaterThan(dipCentre(95));
    expect(dipCentre(95)).toBe(12);
  });

  it("has four blocks, marks past ones, and puts the dip in one block", () => {
    const report = reportFor(ROUGH, at(13, 30));
    expect(report.blocks.map((b) => b.label)).toEqual(["Morning", "Midday", "Afternoon", "Evening"]);
    expect(report.blocks.map((b) => b.status)).toEqual(["past", "now", "later", "later"]);
    expect(report.blocks.every((b) => b.energy.length === 7 && b.focus.length === 7)).toBe(true);
    expect(report.blocks.filter((b) => b.dipHour !== undefined)).toHaveLength(1);
  });

  it("makes the dip visible in the energy curve", () => {
    const rough = reportFor({ ...ROUGH, lastMeal: "4to6h", mealType: "carbs" }, at(9));
    const calm = reportFor(GOOD, at(9));
    const lowest = (r: typeof rough) => Math.min(...r.blocks.flatMap((b) => b.energy));
    expect(rough.blocks.find((b) => b.dipHour !== undefined)).toBeDefined();
    expect(lowest(rough)).toBeLessThan(lowest(calm) - 10);
  });

  it("shows the sleep warning on the evening block only when caffeine was after noon", () => {
    expect(reportFor(ROUGH, at(9)).blocks[3].warning).toMatch(/sleep/);
    expect(reportFor(GOOD, at(9)).blocks[3].warning).toBeUndefined();
  });

  it("only shows a storm warning when conditions are poor", () => {
    expect(reportFor(GOOD, at(9)).stormWarning).toBeNull();
    expect(reportFor({ ...ROUGH, deadlines: "3plus", head: "racing" }, at(9)).stormWarning).not.toBeNull();
    const busy = reportFor({ ...GOOD, meetings: "6plus", head: "racing", deadlines: "3plus" }, at(9));
    expect(busy.stormWarning).toContain("after 4 PM");
  });

  it("reads burnout pressure like a barometer with its trend", () => {
    const calm = reportFor(GOOD, at(9));
    expect(calm.pressure).toMatchObject({ value: 30, trend: "Steady", zone: "Fair" });
    expect(calm.pressure.note).toMatch(/after a few check-ins/);
    expect(reportFor({ ...ROUGH, deadlines: "3plus" }, at(9)).pressure.zone).toBe("Stormy");
  });

  it("names the lowest reading and the biggest drag in the summary", () => {
    const report = reportFor(ROUGH, at(9));
    expect(report.summary).toMatch(/^Lowest reading: \w+/);
    expect(report.summary).toContain("Biggest drag");
  });

  it("adds a tomorrow note only in the evening", () => {
    expect(reportFor({ ...GOOD, tomorrow: "packed" }, at(9)).tomorrowNote).toBeNull();
    expect(reportFor({ ...GOOD, tomorrow: "packed", screens: "likely" }, at(20)).tomorrowNote).toMatch(/packed/);
  });
});
