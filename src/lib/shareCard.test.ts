import { describe, expect, it } from "vitest";
import { drawShareCard, type CardData } from "./shareCard";
import { shareText } from "./share";

/** A stand-in for a canvas that records every piece of text drawn on it. */
function recordingContext() {
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "fillText") return (text: string) => texts.push(text);
        if (prop === "measureText") return (text: string) => ({ width: text.length * 12 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
        return () => undefined;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

const data: CardData = {
  headline: "Foggy and dim morning, 70% chance of a 1 PM crash",
  dateLine: "Saturday 3 October",
  scores: { energy: 27, focus: 26, mood: 51, social: 55, pressure: 52 },
  racing: false,
  energyCurve: [[6, 30], [12, 20], [22, 25]],
  focusCurve: [[6, 30], [12, 20], [22, 25]],
  dipHour: 13,
  crash: 70,
  pressureLine: "Pressure 52 · Change",
  streak: 4,
  achievements: [{ id: "first", label: "First check-in", detail: "x" }],
  night: false,
  host: "example.com",
  fonts: { serif: "Georgia", mono: "monospace" },
};

describe("the share card", () => {
  it("draws only the headline, date, readings, streak and milestones", () => {
    const { ctx, texts } = recordingContext();
    drawShareCard(ctx, data);
    const joined = texts.join(" | ");
    expect(joined).toContain("Foggy and dim morning");
    expect(joined).toContain("Energy");
    expect(joined).toContain("Day 4 in a row");
    expect(joined).toContain("First check-in");
  });

  it("never includes cycle or calendar information", () => {
    const { ctx, texts } = recordingContext();
    drawShareCard(ctx, data);
    const joined = texts.join(" ").toLowerCase();
    for (const word of ["cycle", "period", "pms", "flow", "cramp", "calendar", "meeting", "event", "gap", "back-to-back"]) {
      expect(joined).not.toContain(word);
    }
  });

  it("has no place to put answers: its data holds only scores, curves and public milestones", () => {
    expect(Object.keys(data).sort()).toEqual(
      ["achievements", "crash", "dateLine", "dipHour", "energyCurve", "focusCurve", "fonts", "headline", "host", "night", "pressureLine", "racing", "scores", "streak"].sort(),
    );
  });

  it("keeps the shared text to the headline, readings and milestones too", () => {
    const text = shareText(data.headline, data.scores, data.achievements, "https://example.com").toLowerCase();
    for (const word of ["cycle", "period", "calendar", "meeting", "cramp", "flow"]) expect(text).not.toContain(word);
  });
});
