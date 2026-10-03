// The forecast engine: a transparent, rule-based model.
// computeScores is pure: same answers, history and clock in, same result out.
// Every rule that changes a number is reported back so the UI can explain itself.

import { formatDuration } from "./calendar";
import type {
  Answers,
  Caffeine,
  CheckIn,
  Cramps,
  CyclePhase,
  Flow,
  Deadlines,
  Head,
  LastMeal,
  MealType,
  Meetings,
  Movement,
  Profile,
  ScoreKey,
  Scores,
  SleepHours,
  TrainingLoad,
  Trend,
  WakeFeeling,
  Water,
} from "./types";

export type Delta = Partial<Record<ScoreKey, number>>;

/** Points in Energy / Focus / Mood / Social battery / Burnout pressure order, zeros dropped. */
function v(energy = 0, focus = 0, mood = 0, social = 0, pressure = 0): Delta {
  const all: Delta = { energy, focus, mood, social, pressure };
  return Object.fromEntries(Object.entries(all).filter(([, n]) => n !== 0));
}

/** Rule groups whose points can be scaled up for a given profile. */
type EmphasisGroup = "lastMeal" | "mealType" | "water" | "movement" | "head";

// The direction of each rule follows common sleep, nutrition and exercise
// guidance (short sleep, long gaps without food, dehydration and inactivity
// lower energy and focus; heavy workload raises pressure). The exact values are
// tunable heuristics, not clinically validated.
export const WEIGHTS = {
  baseline: { energy: 70, focus: 70, mood: 65, social: 70, pressure: 30 } satisfies Scores,

  sleep: {
    under5: v(-16, -14, -6, 0, 12),
    "5to6": v(-12, -10, -4, 0, 10),
    "6to7": v(-5, -4, 0, 0, 3),
    "7to8": v(),
    "8plus": v(3, 2),
  } satisfies Record<SleepHours, Delta>,

  wake: {
    rested: v(3),
    okay: v(),
    groggy: v(-6, -4),
    wrecked: v(-10, -7, -3),
  } satisfies Record<WakeFeeling, Delta>,

  lastMeal: {
    within2h: v(),
    "2to4h": v(-2, -2),
    "4to6h": v(-8, -8),
    "6hplus": v(-12, -12, -3),
  } satisfies Record<Exclude<LastMeal, "nothingYet">, Delta>,

  // "Nothing yet" is mild first thing in the morning and heavy later on.
  nothingYet: {
    beforeHour: 11,
    early: v(-3),
    later: v(-14, -14),
  },

  mealType: {
    balanced: v(3),
    carbs: v(-6, -4),
    snack: v(-3),
    coffee: v(-8, -5),
    skipped: v(-8, -6),
  } satisfies Record<MealType, Delta>,

  water: {
    none: v(-6, -4),
    "1to3": v(-3),
    "4plus": v(2),
  } satisfies Record<Water, Delta>,

  caffeine: {
    none: v(),
    "1": v(3, 3),
    "2": v(4, 3),
    "3plus": v(2, -2, 0, -3),
  } satisfies Record<Caffeine, Delta>,

  movement: {
    today: v(3, 0, 4),
    yesterday: v(),
    "2to3days": v(-4, 0, -8, 0, 3),
    cantRemember: v(-6, 0, -10, 0, 4),
  } satisfies Record<Movement, Delta>,

  meetings: {
    "0": v(),
    "1to2": v(0, -1, 0, -8),
    "3to5": v(0, -3, 0, -15, 8),
    "6plus": v(0, -5, 0, -25, 20),
  } satisfies Record<Meetings, Delta>,

  deadlines: {
    none: v(),
    "1": v(0, 0, 0, 0, 5),
    "2": v(0, 0, 0, -5, 12),
    "3plus": v(0, -4, 0, -10, 20),
  } satisfies Record<Deadlines, Delta>,

  training: {
    rest: v(2),
    easy: v(),
    hard: v(-6, 0, 0, 0, 6),
    brutal: v(-12, 0, 0, 0, 12),
  } satisfies Record<TrainingLoad, Delta>,

  head: {
    clear: v(0, 3, 3),
    busy: v(0, -6, -3),
    racing: v(0, -12, -6, -6, 6),
    foggy: v(-4, -14),
    flat: v(-6, 0, -10, -8),
  } satisfies Record<Head, Delta>,

  avoidPeople: v(0, 0, 0, -15),

  // Calendar: back-to-back time on top of the meeting count. Every full hour past
  // `runFreeMinutes` of unbroken meetings adds these points, up to `maxHoursOver` hours.
  calendar: {
    runFreeMinutes: 60,
    maxHoursOver: 3,
    perHourOver: v(0, 0, 0, -4, 3),
  },

  // Cycle: only the person's own answers are used, never dates. Medium flow, mild
  // cramps, "between periods" and "not sure" add nothing.
  cycle: {
    phase: {
      period: v(),
      pms: v(-4, -3, -8, -6, 3),
      between: v(),
      unsure: v(),
    } satisfies Record<CyclePhase, Delta>,
    flow: {
      light: v(-3, 0, -2, 0, 0),
      medium: v(),
      heavy: v(-10, -4, -3, 0, 4),
    } satisfies Record<Flow, Delta>,
    cramps: {
      none: v(),
      mild: v(),
      strong: v(-8, -8, -5, -5, 5),
    } satisfies Record<Cramps, Delta>,
  },

  // Compares Burnout pressure across the most recent earlier check-ins.
  trend: {
    windowSize: 3, // check-ins considered
    windowDays: 7, // ignore anything older than this
    minChange: 8, // pressure points between first and last to count as a trend
    rising: v(0, 0, 0, 0, 5),
    falling: v(0, 0, 0, 0, -5),
  },

  // The profile changes how much some rules count: fuel matters more on a
  // training day, a busy head costs more on a study day, sitting still costs
  // more on a desk day.
  profileEmphasis: {
    desk: { movement: 1.25 },
    study: { head: 1.25 },
    training: { lastMeal: 1.25, mealType: 1.25, water: 1.5 },
  } satisfies Record<Profile, Partial<Record<EmphasisGroup, number>>>,

  crash: {
    baseline: 10,
    meal4to6h: 20,
    meal6hPlusOrNothingAfterNoon: 30,
    afternoonFromHour: 12,
    sugarOrCoffee: 15,
    shortSleep: 15,
    lowEnergy: 10,
    lowEnergyBelow: 40,
    cap: 95,
  },
} as const;

/* ---------- Labels (copy only, no numbers) ---------- */

const LABELS = {
  sleep: {
    under5: "Slept under 5 hours",
    "5to6": "Slept 5-6 hours",
    "6to7": "Slept 6-7 hours",
    "7to8": "Slept 7-8 hours",
    "8plus": "Slept 8+ hours",
  } satisfies Record<SleepHours, string>,
  wake: {
    rested: "Woke up rested",
    okay: "Woke up okay",
    groggy: "Woke up groggy",
    wrecked: "Woke up wrecked",
  } satisfies Record<WakeFeeling, string>,
  lastMeal: {
    within2h: "Ate within the last 2 hours",
    "2to4h": "Last ate 2-4 hours ago",
    "4to6h": "Last ate 4-6 hours ago",
    "6hplus": "Last ate over 6 hours ago",
  } satisfies Record<Exclude<LastMeal, "nothingYet">, string>,
  nothingYetEarly: "Nothing eaten yet this morning",
  nothingYetLater: "Nothing eaten yet today",
  mealType: {
    balanced: "Balanced meal",
    carbs: "Meal was mostly carbs or sugar",
    snack: "Only a light snack",
    coffee: "Just coffee or tea",
    skipped: "Skipped the meal",
  } satisfies Record<MealType, string>,
  water: {
    none: "No water yet",
    "1to3": "Only 1-3 glasses of water",
    "4plus": "4+ glasses of water",
  } satisfies Record<Water, string>,
  caffeine: {
    none: "No caffeine",
    "1": "1 cup of caffeine",
    "2": "2 cups of caffeine",
    "3plus": "3+ cups of caffeine",
  } satisfies Record<Caffeine, string>,
  movement: {
    today: "Moved today",
    yesterday: "Last moved yesterday",
    "2to3days": "Last moved 2-3 days ago",
    cantRemember: "Can't remember last moving",
  } satisfies Record<Movement, string>,
  meetings: {
    "0": "No meetings",
    "1to2": "1-2 meetings today",
    "3to5": "3-5 meetings today",
    "6plus": "6+ meetings today",
  } satisfies Record<Meetings, string>,
  deadlines: {
    none: "No deadlines in the next 48 hours",
    "1": "1 deadline in the next 48 hours",
    "2": "2 deadlines in the next 48 hours",
    "3plus": "3+ deadlines in the next 48 hours",
  } satisfies Record<Deadlines, string>,
  training: {
    rest: "Rest day yesterday",
    easy: "Easy session yesterday",
    hard: "Hard session yesterday",
    brutal: "Brutal session yesterday",
  } satisfies Record<TrainingLoad, string>,
  head: {
    clear: "Head feels clear",
    busy: "Head feels busy",
    racing: "Head is racing",
    foggy: "Head feels foggy",
    flat: "Feeling flat",
  } satisfies Record<Head, string>,
  avoidPeople: "Rather not talk to people today",
  cycle: {
    phase: {
      period: "On your period",
      pms: "Just before your period",
      between: "Between periods",
      unsure: "Cycle: not sure today",
    } satisfies Record<CyclePhase, string>,
    flow: { light: "Light flow", medium: "Medium flow", heavy: "Heavy flow" } satisfies Record<Flow, string>,
    cramps: { none: "No cramps", mild: "Mild cramps", strong: "Strong cramps or pain" } satisfies Record<Cramps, string>,
  },
  trendRising: "Pressure rising over recent check-ins",
  trendFalling: "Pressure easing over recent check-ins",
  crash: {
    meal4to6h: "Crash risk: 4-6 hours since eating",
    meal6hPlus: "Crash risk: over 6 hours since eating",
    nothingAfterNoon: "Crash risk: nothing eaten and it's past noon",
    sugarOrCoffee: "Crash risk: sugar-heavy meal or just coffee",
    shortSleep: "Crash risk: under 6 hours of sleep",
    lowEnergy: "Crash risk: energy below 40",
  },
} as const;

const PROFILE_NAMES: Record<Profile, string> = {
  desk: "desk day",
  study: "study day",
  training: "training day",
};

/** Which of the four "how many meetings" answers a count of meetings falls into. */
export function meetingsBucket(count: number): Meetings {
  return count === 0 ? "0" : count <= 2 ? "1to2" : count <= 5 ? "3to5" : "6plus";
}

/* ---------- Engine ---------- */

export type RuleHit = {
  id: string;
  label: string;
  /** Points added to each score (and to crash probability, for crash rules). */
  delta: Delta & { crash?: number };
};

export type ScoreResult = {
  scores: Scores;
  /** Probability (%) of an energy crash later today. Rule-based, never random. */
  crash: number;
  trend: Trend;
  rules: RuleHit[];
  flags: {
    /** Caffeine after noon: evening sleep may suffer. */
    eveningSleepWarning: boolean;
  };
};

const SCORE_KEYS: ScoreKey[] = ["energy", "focus", "mood", "social", "pressure"];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Rounds half away from zero so -7.5 and 7.5 scale symmetrically. */
const roundPoints = (n: number) => Math.sign(n) * Math.round(Math.abs(n));

function pressureTrend(history: CheckIn[], now: Date): Trend {
  const { windowSize, windowDays, minChange } = WEIGHTS.trend;
  const earliest = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const recent = history
    .map((c) => ({ time: Date.parse(c.date), pressure: c.scores?.pressure }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.pressure) &&
        c.time < now.getTime() &&
        c.time >= earliest,
    )
    .sort((a, b) => a.time - b.time)
    .slice(-windowSize);

  if (recent.length < 2) return "Steady";
  const change = recent[recent.length - 1].pressure - recent[0].pressure;
  if (change >= minChange) return "Rising";
  if (change <= -minChange) return "Falling";
  return "Steady";
}

export function computeScores(
  answers: Answers,
  history: CheckIn[],
  now: Date,
): ScoreResult {
  const rules: RuleHit[] = [];
  const emphasis: Partial<Record<EmphasisGroup, number>> = answers.profile
    ? WEIGHTS.profileEmphasis[answers.profile]
    : {};

  const add = (id: string, label: string, delta: Delta, group?: EmphasisGroup) => {
    const factor = (group && emphasis[group]) || 1;
    const scaled: Delta = {};
    for (const key of SCORE_KEYS) {
      const points = roundPoints((delta[key] ?? 0) * factor);
      if (points !== 0) scaled[key] = points;
    }
    if (Object.keys(scaled).length === 0) return;
    const suffix = factor !== 1 && answers.profile ? ` (counts more on a ${PROFILE_NAMES[answers.profile]})` : "";
    rules.push({ id, label: label + suffix, delta: scaled });
  };

  const hour = now.getHours();

  if (answers.sleep) add(`sleep.${answers.sleep}`, LABELS.sleep[answers.sleep], WEIGHTS.sleep[answers.sleep]);
  if (answers.wake) add(`wake.${answers.wake}`, LABELS.wake[answers.wake], WEIGHTS.wake[answers.wake]);

  if (answers.lastMeal === "nothingYet") {
    const early = hour < WEIGHTS.nothingYet.beforeHour;
    add(
      early ? "lastMeal.nothingYet.early" : "lastMeal.nothingYet.later",
      early ? LABELS.nothingYetEarly : LABELS.nothingYetLater,
      early ? WEIGHTS.nothingYet.early : WEIGHTS.nothingYet.later,
      "lastMeal",
    );
  } else if (answers.lastMeal) {
    add(`lastMeal.${answers.lastMeal}`, LABELS.lastMeal[answers.lastMeal], WEIGHTS.lastMeal[answers.lastMeal], "lastMeal");
  }

  if (answers.mealType) add(`mealType.${answers.mealType}`, LABELS.mealType[answers.mealType], WEIGHTS.mealType[answers.mealType], "mealType");
  if (answers.water) add(`water.${answers.water}`, LABELS.water[answers.water], WEIGHTS.water[answers.water], "water");
  if (answers.caffeine) add(`caffeine.${answers.caffeine}`, LABELS.caffeine[answers.caffeine], WEIGHTS.caffeine[answers.caffeine]);
  if (answers.movement) add(`movement.${answers.movement}`, LABELS.movement[answers.movement], WEIGHTS.movement[answers.movement], "movement");
  // A connected calendar stands in for the "how many meetings" answer.
  const meetings = answers.meetings ?? (answers.calendar ? meetingsBucket(answers.calendar.count) : undefined);
  if (meetings) add(`meetings.${meetings}`, LABELS.meetings[meetings], WEIGHTS.meetings[meetings]);
  if (answers.calendar) {
    const c = WEIGHTS.calendar;
    const hoursOver = clamp((answers.calendar.longestRunMinutes - c.runFreeMinutes) / 60, 0, c.maxHoursOver);
    if (hoursOver > 0) {
      const scaled: Delta = {};
      for (const key of SCORE_KEYS) {
        const per = c.perHourOver[key as keyof typeof c.perHourOver];
        if (per) scaled[key] = per * hoursOver;
      }
      add("calendar.backToBack", `Back-to-back meetings for ${formatDuration(answers.calendar.longestRunMinutes)}`, scaled);
    }
  }
  if (answers.deadlines) add(`deadlines.${answers.deadlines}`, LABELS.deadlines[answers.deadlines], WEIGHTS.deadlines[answers.deadlines]);
  if (answers.training) add(`training.${answers.training}`, LABELS.training[answers.training], WEIGHTS.training[answers.training]);
  if (answers.head) add(`head.${answers.head}`, LABELS.head[answers.head], WEIGHTS.head[answers.head], "head");
  if (answers.avoidPeople) add("avoidPeople", LABELS.avoidPeople, WEIGHTS.avoidPeople);

  if (answers.cycle) add(`cycle.phase.${answers.cycle}`, LABELS.cycle.phase[answers.cycle], WEIGHTS.cycle.phase[answers.cycle]);
  if (answers.flow) add(`cycle.flow.${answers.flow}`, LABELS.cycle.flow[answers.flow], WEIGHTS.cycle.flow[answers.flow]);
  if (answers.cramps) add(`cycle.cramps.${answers.cramps}`, LABELS.cycle.cramps[answers.cramps], WEIGHTS.cycle.cramps[answers.cramps]);

  const trend = pressureTrend(history, now);
  if (trend === "Rising") add("trend.rising", LABELS.trendRising, WEIGHTS.trend.rising);
  if (trend === "Falling") add("trend.falling", LABELS.trendFalling, WEIGHTS.trend.falling);

  const scores = { ...WEIGHTS.baseline } as Scores;
  for (const rule of rules) {
    for (const key of SCORE_KEYS) scores[key] += rule.delta[key] ?? 0;
  }
  for (const key of SCORE_KEYS) scores[key] = clamp(scores[key], 0, 100);

  // Crash probability is built only from these rules, on top of the baseline.
  const c = WEIGHTS.crash;
  const crashRule = (id: string, label: string, points: number) =>
    rules.push({ id: `crash.${id}`, label, delta: { crash: points } });

  if (answers.lastMeal === "4to6h") crashRule("meal4to6h", LABELS.crash.meal4to6h, c.meal4to6h);
  if (answers.lastMeal === "6hplus") crashRule("meal6hPlus", LABELS.crash.meal6hPlus, c.meal6hPlusOrNothingAfterNoon);
  if (answers.lastMeal === "nothingYet" && hour >= c.afternoonFromHour)
    crashRule("nothingAfterNoon", LABELS.crash.nothingAfterNoon, c.meal6hPlusOrNothingAfterNoon);
  if (answers.mealType === "carbs" || answers.mealType === "coffee")
    crashRule("sugarOrCoffee", LABELS.crash.sugarOrCoffee, c.sugarOrCoffee);
  if (answers.sleep === "under5" || answers.sleep === "5to6")
    crashRule("shortSleep", LABELS.crash.shortSleep, c.shortSleep);
  if (scores.energy < c.lowEnergyBelow) crashRule("lowEnergy", LABELS.crash.lowEnergy, c.lowEnergy);

  const crashPoints = rules.reduce((sum, r) => sum + (r.delta.crash ?? 0), 0);
  const crash = clamp(c.baseline + crashPoints, 0, c.cap);

  const eveningSleepWarning =
    answers.caffeine !== undefined &&
    answers.caffeine !== "none" &&
    answers.caffeineTiming === "afterNoon";

  return { scores, crash, trend, rules, flags: { eveningSleepWarning } };
}
