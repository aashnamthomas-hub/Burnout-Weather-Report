// Draws the shareable forecast card on a canvas: the sky, the headline, the four
// readings, the day's curve and a few milestones. It is handed only the data
// listed in CardData, so personal answers, calendar and cycle details cannot
// end up on it.

import type { Achievement } from "./achievements";
import { REPORT } from "./report";
import { deriveSky, type SkyState } from "./sky";
import type { Scores } from "./types";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type CardData = {
  headline: string;
  dateLine: string;
  scores: Scores;
  racing: boolean;
  /** Energy and focus across the day as [hour, value] points (6 AM to 10 PM), value 0-100. */
  energyCurve: [number, number][];
  focusCurve: [number, number][];
  /** Hour of the predicted dip, if one should be marked. */
  dipHour: number | null;
  crash: number;
  pressureLine: string;
  streak: number;
  achievements: Achievement[];
  night: boolean;
  host: string;
  fonts: { serif: string; mono: string };
};

const PALETTE = {
  day: {
    clear: ["#6f9fd8", "#d6e3f0"], grey: ["#9aa5b6", "#d3d8e0"], storm: ["#4b4468", "#8e8aa6"],
    cloud: "#ffffff", stormCloud: "#3b3454", fog: "#e9edf2", ground: "#e9edf2", ink: "#17203a", soft: "#4a5470", hair: "rgba(23,32,58,0.35)",
  },
  night: {
    clear: ["#070c1c", "#1c2846"], grey: ["#141a2b", "#2a3247"], storm: ["#120e22", "#2a2440"],
    cloud: "#2c3756", stormCloud: "#0b0916", fog: "#39435e", ground: "#0e1428", ink: "#e9edf2", soft: "#a9b2c6", hair: "rgba(233,237,242,0.35)",
  },
} as const;

const SUN = "#f2a541";
const COLD_FRONT = "#2f5da8";
const WARM_FRONT = "#c2413b";
const SKY_HEIGHT = 820;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${f(r1, r2)},${f(g1, g2)},${f(b1, b2)})`;
};
const rgbMix = (a: readonly [string, string], gloom: number, storm: number, stop: 0 | 1, p: typeof PALETTE.day | typeof PALETTE.night) => {
  // Same blend as the live sky: clear towards grey by mood, then towards storm by pressure.
  const base = hex(a[stop]);
  const grey = hex(p.grey[stop]);
  const st = hex(p.storm[stop]);
  const step = (x: number[], y: number[], t: number) => x.map((v, i) => v + (y[i] - v) * t);
  const [r, g, b] = step(step(base, grey, gloom), st, storm);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
};

/** Small deterministic random numbers so a given forecast always draws the same sky. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.55, y - size * 0.2, size * 0.6, 0, Math.PI * 2);
  ctx.arc(x + size * 1.2, y, size * 0.5, 0, Math.PI * 2);
  ctx.rect(x, y, size * 1.2, size * 0.5);
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawShareCard(ctx: CanvasRenderingContext2D, d: CardData) {
  const p = d.night ? PALETTE.night : PALETTE.day;
  const sky: SkyState = { ...d.scores, racing: d.racing };
  const params = deriveSky(sky);
  const random = rng(d.scores.energy * 1_000_003 + d.scores.focus * 10_007 + d.scores.mood * 101 + d.scores.pressure);
  const darkSky = d.night || params.storm >= 0.55;
  const skyInk = darkSky ? "#e9edf2" : "#17203a";

  // Sky
  const gradient = ctx.createLinearGradient(0, 0, 0, SKY_HEIGHT);
  gradient.addColorStop(0, rgbMix(p.clear, params.gloom, params.storm, 0, p));
  gradient.addColorStop(1, rgbMix(p.clear, params.gloom, params.storm, 1, p));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, SKY_HEIGHT);

  if (d.night) {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = params.stars * (0.3 + random() * 0.7);
      ctx.beginPath();
      ctx.arc(random() * CARD_WIDTH, random() * SKY_HEIGHT * 0.7, 1 + random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sun (a pale moon at night): dimmer and lower when energy is low.
  const sunY = 250 + (1 - params.sun) * 120;
  const glow = ctx.createRadialGradient(830, sunY, 20, 830, sunY, 320);
  glow.addColorStop(0, d.night ? "rgba(233,237,242,0.25)" : "rgba(242,165,65,0.45)");
  glow.addColorStop(1, "rgba(242,165,65,0)");
  ctx.globalAlpha = 0.25 + 0.75 * params.sun;
  ctx.fillStyle = glow;
  ctx.fillRect(430, sunY - 320, 650, 640);
  ctx.fillStyle = d.night ? "#e9edf2" : SUN;
  ctx.beginPath();
  ctx.arc(830, sunY, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Clouds: more cover and a darker colour as mood drops and pressure builds.
  const cloudColour = mix(p.cloud, p.stormCloud, params.storm);
  ctx.fillStyle = cloudColour;
  ctx.globalAlpha = 0.9;
  const count = Math.round(2 + params.cover * 5);
  for (let i = 0; i < count; i++) {
    // Kept in the upper sky so the headline stays easy to read.
    cloud(ctx, -40 + random() * (CARD_WIDTH - 120), 110 + random() * 280, 90 + random() * 110);
  }
  ctx.globalAlpha = 1;

  // Wind streaks for a low social battery or a racing head.
  if (params.wind > 0.15) {
    ctx.strokeStyle = d.night ? "rgba(233,237,242,0.5)" : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < Math.round(params.wind * 9); i++) {
      const x = random() * 700;
      const y = 140 + random() * 280;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 120, y - 18, x + 220, y + 18, x + 340, y);
      ctx.stroke();
    }
  }

  // Fog veil, then rain.
  if (params.fog > 0) {
    ctx.fillStyle = p.fog;
    ctx.globalAlpha = params.fog * 0.5;
    ctx.fillRect(0, 0, CARD_WIDTH, SKY_HEIGHT);
    ctx.globalAlpha = 1;
  }
  if (params.rain > 0.05) {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < Math.round(params.rain * 160); i++) {
      const x = random() * CARD_WIDTH;
      const y = random() * SKY_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 34);
      ctx.stroke();
    }
  }

  // Title, date and headline on the sky.
  ctx.fillStyle = skyInk;
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 40px ${d.fonts.serif}`;
  ctx.fillText("Burnout Weather Report", 72, 100);
  ctx.font = `400 26px ${d.fonts.mono}`;
  ctx.fillText(d.dateLine, 72, 150);

  let size = 96;
  let lines: string[] = [];
  for (; size >= 60; size -= 6) {
    ctx.font = `400 ${size}px ${d.fonts.serif}`;
    lines = wrap(ctx, d.headline, CARD_WIDTH - 144);
    if (lines.length <= 4) break;
  }
  const lineHeight = size * 1.04;
  const top = SKY_HEIGHT - 60 - (lines.length - 1) * lineHeight;
  lines.forEach((line, i) => ctx.fillText(line, 72, top + i * lineHeight));

  // Horizon and ground.
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, SKY_HEIGHT, CARD_WIDTH, CARD_HEIGHT - SKY_HEIGHT);
  ctx.fillStyle = p.ink;
  ctx.fillRect(0, SKY_HEIGHT, CARD_WIDTH, 2);

  // Four readings.
  const readings: [string, number][] = [
    ["Energy", d.scores.energy],
    ["Focus", d.scores.focus],
    ["Mood", d.scores.mood],
    ["Social battery", d.scores.social],
  ];
  readings.forEach(([label, value], i) => {
    const x = 72 + i * 234;
    ctx.fillStyle = p.soft;
    ctx.font = `400 22px ${d.fonts.mono}`;
    ctx.fillText(label, x, 884);
    ctx.fillStyle = p.ink;
    ctx.font = `400 68px ${d.fonts.mono}`;
    ctx.fillText(String(value), x, 954);
  });

  // The day's curve, 6 AM to 10 PM.
  const left = 72;
  const width = CARD_WIDTH - 144;
  const curveTop = 1000;
  const curveHeight = 110;
  const px = (hour: number) => left + (width * (hour - 6)) / 16;
  const py = (v: number) => curveTop + curveHeight * (1 - v / 100);
  ctx.strokeStyle = p.hair;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, curveTop + curveHeight);
  ctx.lineTo(left + width, curveTop + curveHeight);
  ctx.stroke();

  if (d.dipHour !== null && d.crash >= REPORT.crashShownFrom) {
    const x = left + (width * (d.dipHour - 6)) / 16;
    ctx.strokeStyle = d.crash >= REPORT.crashAlarmFrom ? WARM_FRONT : p.soft;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(x, curveTop - 6);
    ctx.lineTo(x, curveTop + curveHeight);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const line = (values: [number, number][], colour: string, widthPx: number, dash: number[]) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = widthPx;
    ctx.setLineDash(dash);
    ctx.lineJoin = "round";
    ctx.beginPath();
    values.forEach(([hour, v], i) => (i === 0 ? ctx.moveTo(px(hour), py(v)) : ctx.lineTo(px(hour), py(v))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(d.focusCurve, COLD_FRONT, 4, [12, 8]);
  line(d.energyCurve, p.ink, 5, []);

  ctx.fillStyle = p.soft;
  ctx.font = `400 20px ${d.fonts.mono}`;
  ["6 AM", "12 PM", "6 PM", "10 PM"].forEach((t, i) => {
    const x = left + (width * [0, 6, 12, 16][i]) / 16;
    ctx.textAlign = i === 0 ? "left" : i === 3 ? "right" : "center";
    ctx.fillText(t, x, curveTop + curveHeight + 30);
  });
  ctx.textAlign = "left";

  // Streak and milestones, like the stats under a run.
  ctx.fillStyle = p.ink;
  ctx.font = `400 26px ${d.fonts.mono}`;
  ctx.fillText(d.pressureLine, 72, 1204);
  if (d.streak > 1) {
    ctx.textAlign = "right";
    ctx.fillText(`Day ${d.streak} in a row`, CARD_WIDTH - 72, 1204);
    ctx.textAlign = "left";
  }

  d.achievements.slice(0, 3).forEach((a, i) => {
    const y = 1252 + i * 0;
    const x = 72 + i * 312;
    ctx.fillStyle = SUN;
    ctx.beginPath();
    ctx.arc(x + 9, y - 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.ink;
    ctx.font = `400 28px ${d.fonts.serif}`;
    ctx.fillText(a.label, x + 28, y);
  });

  ctx.fillStyle = p.soft;
  ctx.font = `italic 400 24px ${d.fonts.serif}`;
  ctx.fillText("Check your own weather before you plan the day.", 72, 1316);
  ctx.textAlign = "right";
  ctx.font = `400 22px ${d.fonts.mono}`;
  ctx.fillText(d.host, CARD_WIDTH - 72, 1316);
  ctx.textAlign = "left";
}
