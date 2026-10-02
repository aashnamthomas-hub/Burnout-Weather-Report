import { describe, expect, it } from "vitest";
import { isVeryLowDay, needsSupportNote, SUPPORT_NOTE } from "./safety";
import type { CheckIn, Scores } from "./types";

const now = new Date(2026, 9, 3, 18);
const scores = (over: Partial<Scores> = {}): Scores => ({ energy: 60, focus: 60, mood: 60, social: 60, pressure: 30, ...over });
const day = (daysAgo: number, over: Partial<Scores> = {}): CheckIn => ({
  date: new Date(2026, 9, 3 - daysAgo, 9).toISOString(),
  answers: {},
  scores: scores(over),
  crash: 10,
});

describe("isVeryLowDay", () => {
  it("counts very low mood, or low mood with very low energy", () => {
    expect(isVeryLowDay(scores({ mood: 30 }))).toBe(true);
    expect(isVeryLowDay(scores({ mood: 38, energy: 25 }))).toBe(true);
    expect(isVeryLowDay(scores({ mood: 38, energy: 50 }))).toBe(false);
    expect(isVeryLowDay(scores({ mood: 55, energy: 10 }))).toBe(false);
    expect(isVeryLowDay(undefined)).toBe(false);
  });
});

describe("needsSupportNote", () => {
  it("shows after three very low days in a row, today included", () => {
    expect(needsSupportNote([day(1, { mood: 20 }), day(2, { mood: 25 })], scores({ mood: 28 }), now)).toBe(true);
  });

  it("counts low mood with very low energy", () => {
    const history = [day(1, { mood: 38, energy: 20 }), day(2, { mood: 35, energy: 28 })];
    expect(needsSupportNote(history, scores({ mood: 20 }), now)).toBe(true);
  });

  it("does not show for two days, a gap, or when today is better", () => {
    expect(needsSupportNote([day(1, { mood: 20 })], scores({ mood: 20 }), now)).toBe(false);
    expect(needsSupportNote([day(1, { mood: 20 }), day(3, { mood: 20 })], scores({ mood: 20 }), now)).toBe(false);
    expect(needsSupportNote([day(1, { mood: 20 }), day(2, { mood: 20 })], scores({ mood: 60 }), now)).toBe(false);
  });

  it("does not diagnose or give medical advice", () => {
    const text = `${SUPPORT_NOTE.body} ${SUPPORT_NOTE.urgent}`.toLowerCase();
    for (const word of ["depress", "anxiety", "disorder", "diagnos", "medication", "therapy"]) {
      expect(text).not.toContain(word);
    }
    expect(text).toContain("someone you trust");
    expect(text).toContain("professional");
  });
});
