// The check-in question bank and the pure logic that picks the next question.
// Nothing here is precomputed: getNextQuestion looks at the answers so far, the
// saved history and the clock, and returns the highest-priority eligible
// question that has not been asked yet (or "done").

import type { Answers, CheckIn, Profile } from "./types";

export type Option = { value: string; label: string; hint?: string };

export type QuestionContext = {
  answers: Answers;
  history: CheckIn[];
  now: Date;
};

/** One row of chips. A question is either one field, or a few fields shown together. */
export type Field = {
  key: keyof Answers;
  /** Several chips can be picked; the answer is a list. */
  multi?: boolean;
  /** Shown above the chips when a question has more than one field. */
  label?: string;
  options: Option[];
  /** Hidden fields are not asked and their answers are dropped. */
  showIf?: (answers: Answers) => boolean;
};

/** Settings that change which questions exist. */
export type QuestionOptions = {
  /** The person chose to factor in their cycle. Cycle questions never appear without this. */
  cycle?: boolean;
};

export type QuestionId =
  | "cycle"
  | "flow"
  | "cramps"
  | "noticing"
  | "profile"
  | "sleep"
  | "wake"
  | "sleepNights"
  | "sleepBlocker"
  | "lastMeal"
  | "mealType"
  | "canEat"
  | "waterCaffeine"
  | "jittery"
  | "movement"
  | "movementBlocker"
  | "meetings"
  | "gaps"
  | "skippable"
  | "deadlines"
  | "firstDeadline"
  | "training"
  | "pain"
  | "head"
  | "racingAbout"
  | "weighing"
  | "tomorrow"
  | "screens"
  | "final";

export type Question = {
  id: QuestionId;
  /** Higher is asked first. */
  priority: number;
  /** Core questions are always asked when eligible; the rest compete for a limited budget. */
  core?: boolean;
  /** Safety and food-access follow-ups may use the last slot in the budget. */
  essential?: boolean;
  /** Slots to keep free for this question's follow-ups while it is still waiting to be asked. */
  reserves?: number;
  /** "choice" advances on tap, "group" has several rows and a Next button, "final" is the last screen. */
  kind: "choice" | "group" | "final";
  /** Optional questions can be skipped. */
  skippable?: boolean;
  text: (ctx: QuestionContext) => string;
  help?: (ctx: QuestionContext) => string | undefined;
  fields: (ctx: QuestionContext) => Field[];
  askIf: (answers: Answers, history: CheckIn[], now: Date, options: QuestionOptions) => boolean;
};

/** Most questions in one check-in (not counting the final confirm screen). */
export const MAX_QUESTIONS = 11;
/** Turning on the cycle adds up to two follow-ups (flow and cramps), so the limit grows by that much. */
export const CYCLE_EXTRA_QUESTIONS = 2;

export const maxQuestions = (options: QuestionOptions) => MAX_QUESTIONS + (options.cycle ? CYCLE_EXTRA_QUESTIONS : 0);

/** Thresholds for reading history. These steer which questions appear; they don't change scores. */
export const HISTORY_RULES = {
  lowMoodBelow: 40,
  lowMoodDays: 3,
  shortSleepDays: 2,
  /** Nothing eaten by this hour triggers the "can you eat soon?" follow-up. */
  lateMealFromHour: 14,
  eveningFromHour: 18,
} as const;

/* ---------- Time and history helpers ---------- */

export type PartOfDay = "morning" | "afternoon" | "evening";

export function partOfDay(now: Date): PartOfDay {
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < HISTORY_RULES.eveningFromHour) return "afternoon";
  return "evening";
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * How many days in a row, counting back from yesterday, had a check-in that
 * passes `test`. Today's own check-ins are ignored; a day with several
 * check-ins uses the latest one.
 */
export function consecutiveDaysBefore(
  history: CheckIn[],
  now: Date,
  test: (checkIn: CheckIn) => boolean,
): number {
  const latestByDay = new Map<string, { time: number; checkIn: CheckIn }>();
  for (const checkIn of history) {
    const time = Date.parse(checkIn?.date);
    if (!Number.isFinite(time) || time >= now.getTime()) continue;
    const key = dayKey(new Date(time));
    const seen = latestByDay.get(key);
    if (!seen || time > seen.time) latestByDay.set(key, { time, checkIn });
  }

  let days = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (;;) {
    cursor.setDate(cursor.getDate() - 1);
    const entry = latestByDay.get(dayKey(cursor));
    if (!entry || !test(entry.checkIn)) return days;
    days += 1;
  }
}

const isShortSleep = (answers: Answers) => answers.sleep === "under5" || answers.sleep === "5to6";

/** Days in a row of short sleep including today, or 0 when today's sleep wasn't short. */
export function shortSleepStreak(answers: Answers, history: CheckIn[], now: Date): number {
  if (!isShortSleep(answers)) return 0;
  return 1 + consecutiveDaysBefore(history, now, (c) => isShortSleep(c.answers ?? {}));
}

export function lowMoodStreak(history: CheckIn[], now: Date): number {
  return consecutiveDaysBefore(
    history,
    now,
    (c) => Number.isFinite(c.scores?.mood) && c.scores.mood < HISTORY_RULES.lowMoodBelow,
  );
}

/* ---------- Option sets ---------- */

const yesNo = (yes: string, no: string): Option[] => [
  { value: "yes", label: yes },
  { value: "no", label: no },
];

const MEAL_EXAMPLES = {
  morning: {
    balanced: "Dal-roti, eggs, curd and fruit, paneer paratha with curd",
    carbs: "Plain poha, white bread, biscuits, sweets",
    snack: "A fruit, a handful of nuts, a small samosa",
    coffee: "Chai or coffee, with or without a biscuit",
  },
  later: {
    balanced: "Dal-roti, rice with dal and sabzi, eggs, paneer",
    carbs: "Plain rice, white bread, biscuits, sweets",
    snack: "A fruit, a handful of nuts, a small samosa",
    coffee: "Chai or coffee, with or without a biscuit",
  },
} as const;

/* ---------- The bank ---------- */

const PROFILE_OPTIONS: Option[] = [
  { value: "desk", label: "Desk", hint: "Meetings, email, screens" },
  { value: "study", label: "Study", hint: "Lectures, reading, exams" },
  { value: "training", label: "Training", hint: "Gym, sport, a long run" },
];

const single = (key: keyof Answers, options: Option[]) => () => [{ key, options }];

const profileIs = (profile: Profile) => (a: Answers) => a.profile === profile;

export const QUESTIONS: Question[] = [
  {
    id: "profile",
    priority: 100,
    core: true,
    kind: "choice",
    text: () => "What kind of day is it?",
    help: () => "Pick the one that fits best. It changes which questions come next.",
    fields: single("profile", PROFILE_OPTIONS),
    askIf: () => true,
  },
  {
    id: "sleep",
    priority: 90,
    core: true,
    kind: "choice",
    text: () => "How many hours did you sleep last night?",
    help: () => "A rough guess is fine.",
    fields: single("sleep", [
      { value: "under5", label: "Under 5 hours" },
      { value: "5to6", label: "5-6 hours" },
      { value: "6to7", label: "6-7 hours" },
      { value: "7to8", label: "7-8 hours" },
      { value: "8plus", label: "8+ hours" },
    ]),
    askIf: () => true,
  },
  {
    id: "wake",
    priority: 88,
    kind: "choice",
    text: () => "How did you wake up?",
    fields: single("wake", [
      { value: "rested", label: "Rested" },
      { value: "okay", label: "Okay" },
      { value: "groggy", label: "Groggy" },
      { value: "wrecked", label: "Wrecked" },
    ]),
    askIf: (a) => a.sleep !== undefined && a.sleep !== "8plus",
  },
  {
    id: "sleepBlocker",
    priority: 89,
    kind: "choice",
    text: ({ answers, history, now }) =>
      `Sleep has been short for ${shortSleepStreak(answers, history, now)} days. What's getting in the way?`,
    fields: single("sleepBlocker", [
      { value: "work", label: "Work or study" },
      { value: "screens", label: "Late-night screens" },
      { value: "mind", label: "Can't switch off" },
      { value: "other", label: "Something else" },
    ]),
    askIf: (a, h, n) => shortSleepStreak(a, h, n) >= HISTORY_RULES.shortSleepDays,
  },
  {
    id: "sleepNights",
    priority: 89,
    essential: true,
    kind: "choice",
    text: () => "How many nights this week were under 6 hours?",
    help: () => "Including last night.",
    fields: single("sleepNights", [
      { value: "0to1", label: "None or just last night" },
      { value: "2to3", label: "2-3 nights" },
      { value: "4plus", label: "4 or more" },
    ]),
    // The streak question above covers people whose short sleep is a pattern.
    askIf: (a, h, n) =>
      a.sleep === "under5" && shortSleepStreak(a, h, n) < HISTORY_RULES.shortSleepDays,
  },
  {
    id: "lastMeal",
    priority: 80,
    core: true,
    kind: "choice",
    text: () => "When did you last eat?",
    fields: single("lastMeal", [
      { value: "within2h", label: "Within 2 hours" },
      { value: "2to4h", label: "2-4 hours ago" },
      { value: "4to6h", label: "4-6 hours ago" },
      { value: "6hplus", label: "6+ hours ago" },
      { value: "nothingYet", label: "Nothing yet today" },
    ]),
    askIf: () => true,
  },
  {
    id: "canEat",
    priority: 79,
    essential: true,
    kind: "choice",
    text: () => "Can you eat in the next 30 minutes?",
    help: () => "Food comes first in your advice, so this helps us make it realistic.",
    fields: single("canEat", yesNo("Yes, I can", "Not really")),
    askIf: (a, _h, n) =>
      a.lastMeal === "nothingYet" && n.getHours() >= HISTORY_RULES.lateMealFromHour,
  },
  {
    id: "mealType",
    priority: 78,
    kind: "choice",
    text: () => "What was that meal?",
    help: () => "The examples are only a guide. Pick the closest match.",
    fields: ({ now }) => {
      const ex = partOfDay(now) === "morning" ? MEAL_EXAMPLES.morning : MEAL_EXAMPLES.later;
      return [
        {
          key: "mealType",
          options: [
            { value: "balanced", label: "Balanced", hint: ex.balanced },
            { value: "carbs", label: "Mostly carbs or sugar", hint: ex.carbs },
            { value: "snack", label: "Light snack", hint: ex.snack },
            { value: "coffee", label: "Just coffee or tea", hint: ex.coffee },
            { value: "skipped", label: "Skipped the meal" },
          ],
        },
      ];
    },
    askIf: (a) => a.lastMeal !== undefined && a.lastMeal !== "nothingYet",
  },
  {
    id: "waterCaffeine",
    priority: 70,
    core: true,
    kind: "group",
    text: ({ now }) =>
      partOfDay(now) === "evening" ? "Water and caffeine today" : "Water and caffeine so far today",
    help: ({ now }) =>
      partOfDay(now) === "evening"
        ? "Caffeine late in the day can follow you into tonight's sleep."
        : "Tea, coffee and energy drinks all count as caffeine.",
    fields: () => [
      {
        key: "water",
        label: "Water",
        options: [
          { value: "none", label: "None yet" },
          { value: "1to3", label: "1-3 glasses" },
          { value: "4plus", label: "4+ glasses" },
        ],
      },
      {
        key: "caffeine",
        label: "Caffeine",
        options: [
          { value: "none", label: "None" },
          { value: "1", label: "1 cup" },
          { value: "2", label: "2 cups" },
          { value: "3plus", label: "3+ cups" },
        ],
      },
      {
        key: "caffeineTiming",
        label: "Latest cup",
        options: [
          { value: "beforeNoon", label: "Before noon" },
          { value: "afterNoon", label: "After noon" },
        ],
        showIf: (a) => a.caffeine !== undefined && a.caffeine !== "none",
      },
    ],
    askIf: () => true,
  },
  {
    id: "jittery",
    priority: 69,
    kind: "choice",
    text: () => "Are you feeling jittery or restless?",
    fields: single("jittery", yesNo("Yes, a bit", "No, I'm fine")),
    askIf: (a) => a.caffeine === "3plus",
  },
  {
    id: "movement",
    priority: 60,
    core: true,
    kind: "choice",
    text: () => "When did you last move for 10+ minutes?",
    help: () => "A walk counts.",
    fields: single("movement", [
      { value: "today", label: "Today" },
      { value: "yesterday", label: "Yesterday" },
      { value: "2to3days", label: "2-3 days ago" },
      { value: "cantRemember", label: "Can't remember" },
    ]),
    askIf: () => true,
  },
  {
    id: "movementBlocker",
    priority: 59,
    kind: "choice",
    text: () => "What's getting in the way of moving?",
    fields: single("movementBlocker", [
      { value: "time", label: "Time" },
      { value: "energy", label: "Energy" },
      { value: "weather", label: "Weather" },
      { value: "havent", label: "Just haven't" },
    ]),
    askIf: (a) => a.movement === "2to3days" || a.movement === "cantRemember",
  },
  {
    id: "meetings",
    priority: 50,
    core: true,
    kind: "choice",
    text: () => "How many meetings do you have today?",
    fields: single("meetings", [
      { value: "0", label: "None" },
      { value: "1to2", label: "1-2" },
      { value: "3to5", label: "3-5" },
      { value: "6plus", label: "6+" },
    ]),
    // A connected calendar answers this for the forecast.
    askIf: (a) => a.profile === "desk" && !a.calendar,
  },
  {
    id: "deadlines",
    priority: 50,
    core: true,
    kind: "choice",
    text: () => "Any exams or deadlines in the next 48 hours?",
    fields: single("deadlines", [
      { value: "none", label: "None" },
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3plus", label: "3+" },
    ]),
    askIf: profileIs("study"),
  },
  {
    id: "training",
    priority: 50,
    core: true,
    kind: "choice",
    text: () => "How was yesterday's session?",
    fields: single("training", [
      { value: "rest", label: "Rest day" },
      { value: "easy", label: "Easy" },
      { value: "hard", label: "Hard" },
      { value: "brutal", label: "Brutal" },
    ]),
    askIf: profileIs("training"),
  },
  {
    id: "pain",
    priority: 49,
    essential: true,
    kind: "choice",
    text: () => "Any pain beyond normal soreness?",
    help: () => "Sharp, joint or lingering pain, not the usual tired-muscle ache.",
    fields: single("pain", [
      { value: "soreness", label: "Just normal soreness" },
      { value: "pain", label: "Yes, some pain" },
    ]),
    askIf: (a) => a.profile === "training" && (a.training === "hard" || a.training === "brutal"),
  },
  {
    id: "gaps",
    priority: 49,
    kind: "choice",
    text: () => "Are there any gaps of 15+ minutes between meetings?",
    fields: single("gaps", yesNo("Yes, a few", "No, back to back")),
    // A connected calendar already answers this.
    askIf: (a) => a.profile === "desk" && a.meetings === "6plus" && !a.calendar,
  },
  {
    id: "skippable",
    priority: 48,
    kind: "choice",
    text: () => "Could any of them be skipped or moved?",
    fields: single("skippable", yesNo("Yes, maybe one", "No, they're all fixed")),
    askIf: (a) => a.profile === "desk" && (a.meetings === "6plus" || (a.calendar?.count ?? 0) >= 6),
  },
  {
    id: "firstDeadline",
    priority: 49,
    kind: "choice",
    text: () => "When is the first one due?",
    fields: single("firstDeadline", [
      { value: "today", label: "Today" },
      { value: "tomorrow", label: "Tomorrow" },
      { value: "dayAfter", label: "The day after" },
    ]),
    askIf: (a) => a.profile === "study" && a.deadlines === "3plus",
  },
  {
    id: "cycle",
    priority: 45,
    core: true,
    reserves: CYCLE_EXTRA_QUESTIONS,
    kind: "choice",
    text: () => "Where are you in your cycle?",
    help: () => "Only your own answer is used. Nothing is guessed from dates, and it stays in this browser.",
    fields: single("cycle", [
      { value: "period", label: "On my period" },
      { value: "pms", label: "Just before my period", hint: "PMS days" },
      { value: "between", label: "Between periods" },
      { value: "unsure", label: "Not sure or not applicable today" },
    ]),
    askIf: (_a, _h, _n, o) => Boolean(o.cycle),
  },
  {
    id: "flow",
    priority: 44,
    core: true,
    kind: "choice",
    text: () => "How heavy is your flow?",
    fields: single("flow", [
      { value: "light", label: "Light" },
      { value: "medium", label: "Medium" },
      { value: "heavy", label: "Heavy" },
    ]),
    askIf: (a, _h, _n, o) => Boolean(o.cycle) && a.cycle === "period",
  },
  {
    id: "cramps",
    priority: 43,
    core: true,
    kind: "choice",
    text: () => "Any cramps or pain?",
    fields: single("cramps", [
      { value: "none", label: "None" },
      { value: "mild", label: "Mild" },
      { value: "strong", label: "Strong" },
    ]),
    askIf: (a, _h, _n, o) => Boolean(o.cycle) && a.cycle === "period",
  },
  {
    id: "noticing",
    priority: 44,
    core: true,
    kind: "group",
    text: () => "What are you noticing?",
    help: () => "Pick any that fit, or none.",
    fields: () => [
      {
        key: "noticing",
        multi: true,
        options: [
          { value: "mood", label: "Mood dips" },
          { value: "cravings", label: "Cravings" },
          { value: "bloating", label: "Bloating" },
          { value: "sleep", label: "Trouble sleeping" },
          { value: "nothing", label: "Nothing in particular" },
        ],
      },
    ],
    askIf: (a, _h, _n, o) => Boolean(o.cycle) && a.cycle === "pms",
  },
  {
    id: "head",
    priority: 40,
    core: true,
    kind: "choice",
    text: ({ now }) =>
      partOfDay(now) === "evening"
        ? "How does your head feel as the day winds down?"
        : "How does your head feel right now?",
    fields: single("head", [
      { value: "clear", label: "Clear" },
      { value: "busy", label: "Busy" },
      { value: "racing", label: "Racing" },
      { value: "foggy", label: "Foggy" },
      { value: "flat", label: "Flat" },
    ]),
    askIf: () => true,
  },
  {
    id: "racingAbout",
    priority: 39,
    essential: true,
    kind: "choice",
    text: () => "What's it racing about?",
    fields: single("racingAbout", [
      { value: "work", label: "Work" },
      { value: "exams", label: "Exams" },
      { value: "personal", label: "Something personal" },
      { value: "nothing", label: "Nothing specific" },
    ]),
    askIf: (a) => a.head === "racing",
  },
  {
    id: "weighing",
    priority: 38,
    kind: "choice",
    skippable: true,
    text: () => "Anything weighing on you lately?",
    help: () => "Entirely optional. You can skip this one.",
    fields: single("weighing", [
      { value: "yes", label: "Yes, a bit" },
      { value: "no", label: "Not really" },
    ]),
    askIf: (_a, h, n) => lowMoodStreak(h, n) >= HISTORY_RULES.lowMoodDays,
  },
  {
    id: "tomorrow",
    priority: 30,
    kind: "choice",
    text: () => "How does tomorrow look?",
    fields: single("tomorrow", [
      { value: "light", label: "Light" },
      { value: "normal", label: "Normal" },
      { value: "packed", label: "Packed" },
    ]),
    askIf: (_a, _h, n) => partOfDay(n) === "evening",
  },
  {
    id: "screens",
    priority: 29,
    kind: "choice",
    text: () => "Will you be on a screen in the hour before bed?",
    fields: single("screens", [
      { value: "likely", label: "Probably" },
      { value: "unlikely", label: "Probably not" },
    ]),
    askIf: (_a, _h, n) => partOfDay(n) === "evening",
  },
  {
    id: "final",
    priority: 0,
    kind: "final",
    text: () => "Anything else before your forecast?",
    help: () => "Optional. This only changes your social battery.",
    fields: () => [],
    askIf: () => true,
  },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q])) as Record<
  QuestionId,
  Question
>;

/* ---------- Picking the next question ---------- */

const ctxOf = (answers: Answers, history: CheckIn[], now: Date): QuestionContext => ({
  answers,
  history,
  now,
});

/** Fields of a question that are currently shown. */
export function visibleFields(q: Question, ctx: QuestionContext): Field[] {
  return q.fields(ctx).filter((f) => !f.showIf || f.showIf(ctx.answers));
}

/** Answered once every visible field has a value; the final screen is answered by `avoidPeople`. */
export function isAnswered(q: Question, ctx: QuestionContext): boolean {
  if (q.kind === "final") return ctx.answers.avoidPeople !== undefined;
  const fields = visibleFields(q, ctx);
  return fields.length > 0 && fields.every((f) => ctx.answers[f.key] !== undefined);
}

/**
 * Drops answers to questions that no longer apply (for example the wake-up
 * answer after changing sleep to 8+ hours), until nothing more changes.
 */
export function pruneAnswers(answers: Answers, history: CheckIn[], now: Date, options: QuestionOptions = {}): Answers {
  let current = answers;
  for (let pass = 0; pass < QUESTIONS.length; pass++) {
    const next: Answers = { ...current };
    const ctx = ctxOf(current, history, now);
    for (const q of QUESTIONS) {
      if (q.kind === "final") continue;
      const applies = q.askIf(current, history, now, options);
      const shown = new Set<keyof Answers>(applies ? visibleFields(q, ctx).map((f) => f.key) : []);
      for (const field of q.fields(ctx)) {
        if (!shown.has(field.key)) delete next[field.key];
      }
    }
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
  return current;
}

type Planned = { askedCount: number; eligible: Question[]; coreRemaining: number };

function plan(answers: Answers, history: CheckIn[], now: Date, options: QuestionOptions): Planned {
  const ctx = ctxOf(answers, history, now);
  const applicable = QUESTIONS.filter((q) => q.id !== "final" && q.askIf(answers, history, now, options));
  const askedCount = applicable.filter((q) => isAnswered(q, ctx)).length;
  const eligible = applicable
    .filter((q) => !isAnswered(q, ctx))
    .sort((a, b) => b.priority - a.priority);
  // Questions still waiting to be asked also hold back room for their follow-ups.
  const reserved = eligible.reduce((sum, q) => sum + (q.reserves ?? 0), 0);
  return { askedCount, eligible, coreRemaining: eligible.filter((q) => q.core).length + reserved };
}

/** Extra (non-core) questions need room left once the core questions are accounted for. */
const hasRoom = (q: Question, count: number, coreLeft: number, max: number) =>
  count + coreLeft + 1 <= (q.essential ? max : max - 1);

export function getNextQuestion(
  answers: Answers,
  history: CheckIn[],
  now: Date,
  options: QuestionOptions = {},
): Question | "done" {
  const { askedCount, eligible, coreRemaining } = plan(answers, history, now, options);
  const max = maxQuestions(options);
  const next = eligible.find((q) => q.core || hasRoom(q, askedCount, coreRemaining, max));
  if (next) return next;
  return answers.avoidPeople === undefined ? QUESTION_BY_ID.final : "done";
}

/** Best estimate of how many questions this check-in will have, for the progress bar. */
export function getProgress(
  answers: Answers,
  history: CheckIn[],
  now: Date,
  options: QuestionOptions = {},
): { answered: number; total: number } {
  const { askedCount, eligible, coreRemaining } = plan(answers, history, now, options);
  const max = maxQuestions(options);
  let count = askedCount;
  let coreLeft = coreRemaining;
  for (const q of eligible) {
    if (q.core) {
      count += 1;
      coreLeft -= 1 + (q.reserves ?? 0);
    } else if (hasRoom(q, count, coreLeft, max)) {
      count += 1;
    }
  }
  return { answered: askedCount, total: count };
}
