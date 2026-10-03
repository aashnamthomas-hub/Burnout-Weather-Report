// A library of written recommendations. Each one has a trigger rule, a profile
// and a time of day, and always names its reason. pickRecommendations returns
// at most four, ordered safety and sleep, then food, movement, workload, comfort.
// Calm, specific, no guilt, no medical claims.

import { formatDuration, formatMinutes } from "./calendar";
import type { ScoreResult } from "./forecast";
import { dipCentre, type Mode } from "./report";
import type { Answers, Profile } from "./types";

export type Category = "safety" | "sleep" | "food" | "movement" | "workload" | "comfort";
export type RecTime = "morning" | "midday" | "afternoon" | "evening" | "any";

/** An event for this check-in only. Titles are held in memory and never saved. */
export type EventNote = { title: string; start: number; end: number };

export type RecContext = {
  a: Answers;
  r: ScoreResult;
  hour: number;
  /** Minutes since midnight now; defaults to the start of `hour`. */
  minutes?: number;
  /** Today's events with titles, only when the person allowed titles. */
  titles?: EventNote[];
  mode: Mode;
  good: boolean;
};

export type Recommendation = {
  id: string;
  category: Category;
  profile: Profile | "all";
  /** The part of the day it is for. Past parts of the day are never suggested. */
  time: RecTime;
  /** Shown in mono next to the advice, e.g. "Before 11 AM". */
  when?: string;
  /** Advice on the same topic is only shown once; the profile-specific version wins. */
  topic?: string;
  /** Advice based on the person's own calendar or cycle answers wins over general advice in the same category. */
  boost?: number;
  /** Only suggested on good days, as light advice. */
  light?: boolean;
  /** Dropped when the person reports pain beyond soreness. */
  training?: boolean;
  trigger: (c: RecContext) => boolean;
  text: (c: RecContext) => string;
  reason: (c: RecContext) => string;
};

export type Picked = { id: string; category: Category; text: string; reason: string; when?: string };

export const MAX_RECOMMENDATIONS = 4;
const MAX_PER_CATEGORY = 2;
const MAX_ON_GOOD_DAY = 2;

const SHORT_SLEEP = ["under5", "5to6"];
const LONG_SINCE_MEAL = ["4to6h", "6hplus"];

const shortSleep = (a: Answers) => a.sleep !== undefined && SHORT_SLEEP.includes(a.sleep);
const longSinceMeal = (a: Answers) => a.lastMeal !== undefined && LONG_SINCE_MEAL.includes(a.lastMeal);
const emptyAfterTwo = (c: RecContext) => c.a.lastMeal === "nothingYet" && c.hour >= 14;
const nowMinutes = (c: RecContext) => c.minutes ?? c.hour * 60;
const range = (start: number, end: number) => `${formatMinutes(start)} to ${formatMinutes(end)}`;

/** The next free gap (15 minutes or more) that is not already over. */
const nextGap = (c: RecContext) => c.a.calendar?.gaps.find((g) => g.end > nowMinutes(c) + 5);

/** Does the longest back-to-back run overlap the predicted dip (an hour before to three hours after)? */
const runHitsDip = (c: RecContext) => {
  const cal = c.a.calendar;
  if (!cal || cal.longestRunStart === null || cal.longestRunEnd === null || c.r.crash < 40) return false;
  const centre = dipCentre(c.r.crash) * 60;
  return cal.longestRunStart < centre + 180 && cal.longestRunEnd > centre - 60;
};

const PREP = /interview|exam|viva|presentation|pitch|demo|deadline|review/i;
const MEAL = /lunch|dinner|break/i;
const upcoming = (c: RecContext, test: RegExp) => c.titles?.find((t) => t.start > nowMinutes(c) && test.test(t.title));

const hardSession = (a: Answers) => a.training === "hard" || a.training === "brutal";

/** Why food is on the list: how long ago, and what the last meal was. */
const mealReason = (c: RecContext) =>
  emptyAfterTwo(c)
    ? "You haven't eaten yet and it's already afternoon."
    : longSinceMeal(c.a)
      ? `It's been over 4 hours since you ate${c.a.mealType === "carbs" ? ", and the meal was mostly carbs" : c.a.mealType === "coffee" ? ", and it was just coffee or tea" : ""}.`
      : c.a.mealType === "coffee" || c.a.mealType === "skipped"
        ? "Your last meal was just coffee or tea, or skipped."
        : c.a.mealType === "carbs"
          ? "Your last meal was mostly carbs or sugar, which tends to wear off fast."
          : "It's been a couple of hours since you ate.";

export const LIBRARY: Recommendation[] = [
  /* ---------- Safety ---------- */
  {
    id: "pain-rest", category: "safety", profile: "training", time: "any", when: "Today",
    trigger: (c) => c.a.pain === "pain",
    text: () => "Rest today, or keep it to gentle mobility. If the pain lasts or gets worse, see a professional.",
    reason: () => "You mentioned pain beyond normal soreness after a hard session.",
  },

  {
    id: "cycle-heat-rest", boost: 1, category: "safety", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.cramps === "strong",
    text: () => "Many people find a heat pack and some rest help with strong cramps. Go gently today.",
    reason: () => "You said your cramps or pain are strong.",
  },

  /* ---------- Sleep ---------- */
  {
    id: "sleep-pattern", category: "sleep", profile: "all", time: "evening", when: "Tonight",
    trigger: (c) => c.a.sleepNights === "4plus" || c.a.sleepNights === "2to3" || c.a.sleepBlocker !== undefined,
    text: () => "Pick a lights-out time tonight and protect it, even if it's only 30 minutes earlier.",
    reason: (c) =>
      c.a.sleepNights === "4plus"
        ? "Four or more short nights this week add up."
        : "Short sleep has been a pattern lately, and it adds up.",
  },
  {
    id: "sleep-nap", category: "sleep", profile: "all", time: "midday", when: "Before 3 PM",
    trigger: (c) => shortSleep(c.a) && c.hour < 15 && c.r.scores.energy < 55,
    text: () => "If you can, take a 20-minute nap with an alarm set.",
    reason: () => "You slept under 6 hours, and a short nap is cheaper than another coffee.",
  },
  {
    id: "sleep-caffeine-cutoff", category: "sleep", profile: "desk", time: "afternoon", when: "From now",
    trigger: (c) => c.r.flags.eveningSleepWarning && c.hour < 20,
    text: () => "Stop caffeine now; your last cup will cut into tonight's sleep.",
    reason: () => "You had caffeine after noon.",
  },
  {
    id: "sleep-caffeine-cutoff-other", category: "sleep", profile: "study", time: "afternoon", when: "From now",
    trigger: (c) => c.r.flags.eveningSleepWarning && c.hour < 20,
    text: () => "Switch to water or decaf from here; late caffeine makes tonight's sleep shallower.",
    reason: () => "You had caffeine after noon.",
  },
  {
    id: "sleep-caffeine-cutoff-training", category: "sleep", profile: "training", time: "afternoon", when: "From now",
    trigger: (c) => c.r.flags.eveningSleepWarning && c.hour < 20,
    text: () => "Keep the pre-workout and coffee for mornings. Tonight's recovery happens in your sleep.",
    reason: () => "You had caffeine after noon.",
  },
  {
    id: "sleep-nap-study", category: "sleep", profile: "study", time: "midday", when: "Before 3 PM",
    trigger: (c) => (c.a.caffeine === "3plus" || c.a.caffeine === "2") && shortSleep(c.a) && c.hour < 15,
    text: () => "A 20-minute nap with an alarm beats a fourth coffee.",
    reason: () => "You're running on short sleep and a lot of caffeine.",
  },
  {
    id: "sleep-stop-time", category: "sleep", profile: "study", time: "any", when: "Today",
    trigger: (c) => c.a.deadlines === "2" || c.a.deadlines === "3plus" || c.mode === "tonight",
    text: () => "Set tonight's stop time now.",
    reason: () => "With deadlines close, work expands to fill the night unless you cap it.",
  },
  {
    id: "sleep-screens", category: "sleep", profile: "all", time: "evening", when: "An hour before bed",
    trigger: (c) => c.a.screens === "likely",
    text: () => "Dim the lights and put the screen down 30 minutes before bed.",
    reason: () => "You expect to be on a screen before bed, which makes it harder to switch off.",
  },
  {
    id: "sleep-early-night", category: "sleep", profile: "all", time: "evening", when: "Tonight",
    trigger: (c) => c.mode === "tonight" && (c.a.tomorrow === "packed" || shortSleep(c.a)),
    text: () => "Aim to be in bed early tonight.",
    reason: (c) => (c.a.tomorrow === "packed" ? "Tomorrow looks packed." : "You slept short last night and it shows."),
  },
  {
    id: "sleep-jittery", category: "sleep", profile: "all", time: "any", when: "Rest of today",
    trigger: (c) => c.a.jittery === "yes",
    text: () => "Skip more caffeine today. Water and a snack will do more.",
    reason: () => "You said you feel jittery or restless.",
  },

  /* ---------- Food ---------- */
  {
    id: "cal-eat-gap", boost: 1, topic: "eat", category: "food", profile: "all", time: "any",
    trigger: (c) =>
      Boolean(nextGap(c)) &&
      (longSinceMeal(c.a) || emptyAfterTwo(c) || c.a.mealType === "coffee" || c.a.mealType === "skipped" || c.a.mealType === "carbs"),
    text: (c) => `Eat in your gap from ${range(nextGap(c)!.start, nextGap(c)!.end)}: dal-roti, eggs, curd with fruit, or nuts.`,
    reason: (c) => `${mealReason(c)} That is the next free gap in your calendar.`,
  },
  {
    id: "cal-title-lunch", boost: 1, topic: "eat", category: "food", profile: "all", time: "any",
    trigger: (c) => Boolean(upcoming(c, MEAL)) && (longSinceMeal(c.a) || c.a.lastMeal === "2to4h"),
    text: (c) => {
      const e = upcoming(c, MEAL)!;
      return `You already have "${e.title}" at ${formatMinutes(e.start)}. Protect it, and eat something proper then.`;
    },
    reason: () => "You allowed event titles, so this tip can name the break you already have.",
  },
  {
    id: "food-eat-now", topic: "eat", category: "food", profile: "all", time: "any", when: "Within the hour",
    trigger: (c) => longSinceMeal(c.a) || emptyAfterTwo(c),
    text: () => "Eat something with protein within the hour: dal-roti, eggs, curd with fruit, or nuts.",
    reason: mealReason,
  },
  {
    id: "food-nothing-morning", topic: "eat", category: "food", profile: "all", time: "morning", when: "Before 11 AM",
    trigger: (c) => c.a.lastMeal === "nothingYet" && c.hour < 14,
    text: () => "Eat something before 11: poha with peanuts, an egg, or curd with fruit.",
    reason: () => "Nothing eaten yet, and focus drops quickly on an empty stomach.",
  },
  {
    id: "food-cant-eat", category: "food", profile: "all", time: "any", when: "Next gap",
    trigger: (c) => c.a.canEat === "no",
    text: () => "Keep a banana, nuts or roasted chana in your bag for the next gap you get.",
    reason: () => "You can't sit down to eat in the next 30 minutes.",
  },
  {
    id: "food-after-carbs", category: "food", profile: "all", time: "afternoon", when: "Next meal",
    trigger: (c) => c.a.mealType === "carbs",
    text: () => "Pair your next meal with protein: dal, paneer, eggs or curd.",
    reason: () => "Your last meal was mostly carbs or sugar, which tends to wear off fast.",
  },
  {
    id: "food-proper-meal", topic: "eat", category: "food", profile: "all", time: "any", when: "Next meal",
    trigger: (c) => c.a.mealType === "coffee" || c.a.mealType === "skipped",
    text: () => "Have a proper meal rather than another chai.",
    reason: () => "Your last meal was just coffee or tea, or skipped.",
  },
  {
    id: "food-study", topic: "eat", category: "food", profile: "study", time: "any", when: "Before you study",
    trigger: (c) => c.a.lastMeal !== undefined && c.a.lastMeal !== "within2h",
    text: () => "Eat before you open a book.",
    reason: (c) => `${mealReason(c)} Reading on an empty stomach is slow going.`,
  },
  {
    id: "food-training-fuel", topic: "eat", category: "food", profile: "training", time: "any", when: "Within an hour of training",
    trigger: (c) => longSinceMeal(c.a) || c.a.mealType === "coffee" || c.a.mealType === "skipped" || c.a.mealType === "carbs",
    text: () => "Protein and carbs within an hour of training: paneer or eggs with rice or roti.",
    reason: (c) => `${mealReason(c)} That matters more on a training day.`,
  },
  {
    id: "food-water-training", category: "food", profile: "training", time: "any", when: "All day",
    trigger: (c) => c.a.water === "none" || c.a.water === "1to3",
    text: () => "Drink more water. A glass with every break between sets is an easy rhythm.",
    reason: () => "You've had little water so far, and training raises how much you need.",
  },
  {
    id: "food-water", category: "food", profile: "all", time: "any", when: "Now",
    trigger: (c) => c.a.water === "none" || (c.a.water === "1to3" && c.r.scores.energy < 55),
    text: () => "Have a glass of water now, and another with each meal.",
    reason: () => "You've had little water so far today.",
  },
  {
    id: "food-dinner", category: "food", profile: "all", time: "evening", when: "At dinner",
    trigger: (c) => c.mode === "tonight" && (longSinceMeal(c.a) || c.a.mealType === "skipped"),
    text: () => "Eat a proper dinner, and keep it light enough that you can still sleep.",
    reason: () => "It's been a long gap since you last ate.",
  },
  {
    id: "food-protein-light", category: "food", profile: "all", time: "any", light: true,
    trigger: () => true,
    text: () => "Keep your next meal balanced: dal, roti or rice, and some protein.",
    reason: () => "Good fuel is why today is going well.",
  },

  /* ---------- Movement ---------- */
  {
    id: "cal-walk-gap", boost: 1, topic: "walk", category: "movement", profile: "all", time: "any",
    trigger: (c) =>
      Boolean(nextGap(c)) &&
      ((c.a.calendar?.count ?? 0) >= 3 || c.a.movement === "2to3days" || c.a.movement === "cantRemember"),
    text: (c) => `Walk 10 minutes in your gap from ${range(nextGap(c)!.start, nextGap(c)!.end)}.`,
    reason: (c) =>
      (c.a.calendar?.count ?? 0) >= 3
        ? `${c.a.calendar!.count} meetings today is a lot of sitting, and this is your next free gap.`
        : "It has been a couple of days since you moved, and this is your next free gap.",
  },
  {
    id: "move-between-meetings", topic: "walk", category: "movement", profile: "desk", time: "afternoon", when: "Between meetings",
    trigger: (c) => c.a.meetings === "3to5" || c.a.meetings === "6plus",
    text: () => "Walk 10 minutes between meetings.",
    reason: () => "A day of meetings is a lot of sitting, and it drains your social battery.",
  },
  {
    id: "move-walk", topic: "walk", category: "movement", profile: "all", time: "afternoon", when: "Before 5 PM",
    trigger: (c) => c.a.movement === "2to3days" || c.a.movement === "cantRemember",
    text: () => "Take a 10-minute walk before 5.",
    reason: () => "It's been a couple of days since you moved, and mood tends to follow movement.",
  },
  {
    id: "move-blocker-time", category: "movement", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.movementBlocker === "time" && (c.a.movement === "2to3days" || c.a.movement === "cantRemember"),
    text: () => "Ten minutes counts. Walk while you take a call.",
    reason: () => "You said time is what gets in the way.",
  },
  {
    id: "move-blocker-energy", category: "movement", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.movementBlocker === "energy" && (c.a.movement === "2to3days" || c.a.movement === "cantRemember"),
    text: () => "Start with five minutes. Energy often turns up after you've started.",
    reason: () => "You said low energy gets in the way.",
  },
  {
    id: "move-blocker-weather", category: "movement", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.movementBlocker === "weather" && (c.a.movement === "2to3days" || c.a.movement === "cantRemember"),
    text: () => "Go indoors: stairs, or ten minutes of stretching.",
    reason: () => "You said the weather gets in the way.",
  },
  {
    id: "move-blocker-havent", category: "movement", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.movementBlocker === "havent" && (c.a.movement === "2to3days" || c.a.movement === "cantRemember"),
    text: () => "Pick a time for a short walk now and put it in your calendar.",
    reason: () => "A time you've chosen is more likely to happen than a good intention.",
  },
  {
    id: "move-training-swap", category: "movement", profile: "training", time: "any", when: "Today's session", training: true,
    trigger: (c) => hardSession(c.a) && c.r.scores.energy < 55,
    text: () => "Swap the heavy session for mobility or a light jog.",
    reason: () => "Yesterday was hard and your energy is low.",
  },
  {
    id: "move-training-cap", category: "movement", profile: "training", time: "any", when: "Today's session", training: true,
    trigger: (c) => c.r.scores.energy < 60 && !(hardSession(c.a) && c.r.scores.energy < 55),
    text: () => "Cap today's session at 45 minutes.",
    reason: () => "Your energy is below its usual level, so a shorter session still counts.",
  },
  {
    id: "move-training-go", category: "movement", profile: "training", time: "any", when: "Today's session", training: true, light: true,
    trigger: () => true,
    text: () => "Good day to push. Warm up properly, then go for it.",
    reason: () => "Energy and recovery both look good.",
  },
  {
    id: "move-training-rest", category: "movement", profile: "training", time: "any", when: "Today", light: true,
    trigger: (c) => c.a.training === "rest",
    text: () => "You rested yesterday, so an easy walk and a good dinner will do.",
    reason: () => "Recovery is part of the plan.",
  },
  {
    id: "move-stretch-desk", category: "movement", profile: "desk", time: "afternoon", when: "Every hour", light: true,
    trigger: () => true,
    text: () => "Stand and stretch for two minutes each hour.",
    reason: () => "Small breaks keep a good day good.",
  },
  {
    id: "move-evening-walk", category: "movement", profile: "all", time: "evening", when: "After dinner",
    trigger: (c) => c.mode === "tonight" && (c.a.head === "racing" || c.a.head === "busy"),
    text: () => "A slow 10-minute walk after dinner helps a busy head settle.",
    reason: () => "Your head is busy this evening.",
  },

  /* ---------- Workload ---------- */
  {
    id: "cal-b2b-crash", boost: 1, topic: "b2b", category: "food", profile: "all", time: "any",
    trigger: runHitsDip,
    text: (c) =>
      `Your back-to-back run from ${range(c.a.calendar!.longestRunStart!, c.a.calendar!.longestRunEnd!)} lands on your likely dip. Eat before it starts and ask for a 10-minute break in the middle.`,
    reason: (c) =>
      `Crash risk is ${c.r.crash}% around ${formatMinutes(dipCentre(c.r.crash) * 60)}, and that run is ${formatDuration(c.a.calendar!.longestRunMinutes)} with no break.`,
  },
  {
    id: "cal-b2b-long", boost: 1, topic: "b2b", category: "workload", profile: "all", time: "any",
    trigger: (c) => (c.a.calendar?.longestRunMinutes ?? 0) >= 120,
    text: (c) =>
      `You have ${formatDuration(c.a.calendar!.longestRunMinutes)} of back-to-back meetings from ${range(c.a.calendar!.longestRunStart!, c.a.calendar!.longestRunEnd!)}. Ask for five-minute buffers, or end the first one early.`,
    reason: () => "Long unbroken runs wear down focus and social battery.",
  },
  {
    id: "cal-free-morning", boost: 1, topic: "hardest", category: "workload", profile: "desk", time: "morning",
    trigger: (c) => {
      const cal = c.a.calendar;
      return (
        Boolean(cal) &&
        cal!.firstStart !== null &&
        cal!.freeBeforeFirst >= 45 &&
        nowMinutes(c) < cal!.firstStart! - 20 &&
        c.r.scores.focus >= 45
      );
    },
    text: (c) => `You are free until ${formatMinutes(c.a.calendar!.firstStart!)}. Use that window for your hardest task.`,
    reason: () => "A long free stretch before the first meeting is the best focus time you will get today.",
  },
  {
    id: "cal-no-gaps", boost: 1, topic: "buffers", category: "workload", profile: "all", time: "any",
    trigger: (c) => (c.a.calendar?.count ?? 0) >= 3 && c.a.calendar!.gaps.length === 0,
    text: () => "There is no gap longer than 15 minutes today. Ask for five-minute buffers, and keep water and a snack within reach.",
    reason: (c) => `Your calendar has ${c.a.calendar!.count} meetings with no real break between them.`,
  },
  {
    id: "cal-title-prep", boost: 1, topic: "prep", category: "workload", profile: "all", time: "any",
    trigger: (c) => Boolean(upcoming(c, PREP)),
    text: (c) => {
      const e = upcoming(c, PREP)!;
      return `Before "${e.title}" at ${formatMinutes(e.start)}, take ten minutes to prep and have some water.`;
    },
    reason: () => "You allowed event titles, so this tip can name what is coming up.",
  },
  {
    id: "work-hardest-first", topic: "hardest", category: "workload", profile: "desk", time: "morning", when: "Before 11 AM",
    trigger: (c) => c.hour < 11 && c.r.scores.focus >= 45,
    text: () => "Do your hardest task before 11. Block it now.",
    reason: (c) => (c.r.crash >= 40 ? "Your focus is best early and a dip is coming." : "Your focus is best early in the day."),
  },
  {
    id: "work-small-start", category: "workload", profile: "all", time: "any", when: "Next hour",
    trigger: (c) => c.a.head === "foggy" || c.r.scores.focus < 45,
    text: () => "Start with one small, concrete task to get moving, and leave the hardest one for later.",
    reason: () => "Focus is low right now, and a small win makes it easier to start.",
  },
  {
    id: "work-skip-meeting", category: "workload", profile: "desk", time: "any", when: "Today",
    trigger: (c) => c.a.skippable === "yes",
    text: () => "Decline or move one meeting. It's worth a short message.",
    reason: () => "You have six or more meetings and at least one can move.",
  },
  {
    id: "work-use-gaps", category: "workload", profile: "desk", time: "midday", when: "In your gaps",
    trigger: (c) => c.a.gaps === "yes",
    text: () => "Use your gaps: eat in the first one and walk in the next.",
    reason: () => "You have free gaps between a heavy run of meetings.",
  },
  {
    id: "work-buffers", topic: "buffers", category: "workload", profile: "desk", time: "any", when: "Today",
    trigger: (c) => c.a.gaps === "no",
    text: () => "Ask for 5-minute buffers, or end calls five minutes early.",
    reason: () => "Your meetings run back to back with no gaps.",
  },
  {
    id: "work-study-blocks", category: "workload", profile: "study", time: "any", when: "Study blocks",
    trigger: (c) => c.r.scores.focus < 65 || c.a.deadlines === "2" || c.a.deadlines === "3plus",
    text: () => "Hardest topic first, in 25-minute blocks.",
    reason: () => "Short blocks hold up better when focus is limited.",
  },
  {
    id: "work-study-due-today", category: "workload", profile: "study", time: "any", when: "Today",
    trigger: (c) => c.a.firstDeadline === "today",
    text: () => "Start with whatever is due today and park the rest on a list.",
    reason: () => "The first deadline is today.",
  },
  {
    id: "work-racing-work", category: "workload", profile: "all", time: "any", when: "Next 10 minutes",
    trigger: (c) => c.a.head === "racing" && c.a.racingAbout === "work",
    text: () => "Write down everything on your mind, then circle the one that matters most.",
    reason: () => "A racing head about work quiets down once it's on paper.",
  },
  {
    id: "work-racing-exams", category: "workload", profile: "all", time: "any", when: "Next 10 minutes",
    trigger: (c) => c.a.head === "racing" && c.a.racingAbout === "exams",
    text: () => "List what the exam covers and cut it into 25-minute topics.",
    reason: () => "A racing head about exams settles when the work has edges.",
  },
  {
    id: "work-racing-personal", category: "workload", profile: "all", time: "any", when: "Next 10 minutes",
    trigger: (c) => c.a.head === "racing" && c.a.racingAbout === "personal",
    text: () => "Give it ten minutes in writing. You don't have to solve it today.",
    reason: () => "Something personal is on your mind.",
  },
  {
    id: "work-racing-nothing", category: "workload", profile: "all", time: "any", when: "Now",
    trigger: (c) => c.a.head === "racing" && (c.a.racingAbout === "nothing" || c.a.racingAbout === undefined),
    text: () => "Two minutes of slow breathing: in for four, out for six.",
    reason: () => "Your head is racing without a clear cause, and slow breathing is a quick reset.",
  },
  {
    id: "work-protect-morning", category: "workload", profile: "all", time: "morning", when: "This morning", light: true,
    trigger: (c) => c.mode === "day",
    text: () => "Put your most important work in the first half of the day.",
    reason: () => "Your conditions are good, so use them where it counts.",
  },

  /* ---------- Cycle (only when the person has chosen to factor it in) ---------- */
  {
    id: "cycle-iron", boost: 1, category: "food", profile: "all", time: "any", when: "With your meals",
    trigger: (c) => c.a.flow === "heavy",
    text: () => "Many people find iron-rich foods help during a heavy flow: dal, spinach, rajma, chana, jaggery or eggs.",
    reason: () => "You said your flow is heavy.",
  },
  {
    id: "cycle-cravings", boost: 1, category: "food", profile: "all", time: "any", when: "Through the day",
    trigger: (c) => Boolean(c.a.noticing?.includes("cravings")),
    text: () => "Many people find regular meals with some protein steady cravings. A little of what you fancy is fine too.",
    reason: () => "You said you are noticing cravings.",
  },
  {
    id: "cycle-sleep", boost: 1, category: "sleep", profile: "all", time: "evening", when: "Tonight",
    trigger: (c) => Boolean(c.a.noticing?.includes("sleep")),
    text: () => "Many people find a cooler room and a steady wind-down routine help when sleep is patchy around now.",
    reason: () => "You said you are having trouble sleeping.",
  },
  {
    id: "cycle-training", boost: 1, category: "movement", profile: "training", time: "any", when: "Today's session", training: true,
    trigger: (c) => c.a.cycle === "period" || c.a.cycle === "pms",
    text: () => "Go by how you feel: a lighter session or a gentle walk is a fine choice, and so is your usual one.",
    reason: () => "Energy can look different around your period, and either choice is a good one.",
  },
  {
    id: "cycle-study", boost: 1, category: "workload", profile: "study", time: "any", when: "Today",
    trigger: (c) => c.a.cycle === "period" || c.a.cycle === "pms",
    text: () => "Many people find regular meals and a firm stop time help. Keep today's plan realistic rather than smaller.",
    reason: () => "A steady routine carries you through days when energy dips.",
  },
  {
    id: "cycle-desk", boost: 1, category: "workload", profile: "desk", time: "any", when: "Today",
    trigger: (c) => c.a.cycle === "period" || c.a.cycle === "pms",
    text: () => "Keep water and a snack within reach, and put the tasks that need the most focus where you feel best.",
    reason: () => "Small comforts make a full day easier to get through.",
  },
  {
    id: "cycle-bloating", boost: 1, category: "comfort", profile: "all", time: "any", when: "Today",
    trigger: (c) => Boolean(c.a.noticing?.includes("bloating")),
    text: () => "Many people find warm drinks, loose clothes and a gentle walk ease bloating.",
    reason: () => "You said you are noticing bloating.",
  },
  {
    id: "cycle-mood", boost: 1, category: "comfort", profile: "all", time: "any", when: "Today",
    trigger: (c) => Boolean(c.a.noticing?.includes("mood")),
    text: () => "Mood dips around now are common for many people. Go easy on yourself, and let small things count.",
    reason: () => "You said you are noticing mood dips.",
  },
  {
    id: "cycle-lighter-day", boost: 1, category: "comfort", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.cycle === "period" && c.r.scores.energy < 50,
    text: () => "A lighter day is a sensible plan, not a setback. Pick the one or two things that matter and let the rest wait.",
    reason: () => "Your energy is lower today.",
  },

  /* ---------- Comfort ---------- */
  {
    id: "comfort-avoid-people", category: "comfort", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.avoidPeople === true,
    text: () => "It's fine to say no today. A short message can stand in for a call.",
    reason: () => "You'd rather not talk to people today.",
  },
  {
    id: "comfort-quiet-evening", category: "comfort", profile: "all", time: "evening", when: "This evening",
    trigger: (c) => c.r.scores.social < 40,
    text: () => "Keep the evening quiet and leave a stretch where no one needs anything from you.",
    reason: () => "Your social battery is low.",
  },
  {
    id: "comfort-daylight", category: "comfort", profile: "all", time: "midday", when: "Next hour",
    trigger: (c) => c.a.head === "foggy" && c.hour < 17,
    text: () => "Step outside for five minutes of daylight, with some water.",
    reason: () => "Your head feels foggy.",
  },
  {
    id: "comfort-flat", category: "comfort", profile: "all", time: "any", when: "Today",
    trigger: (c) => c.a.head === "flat",
    text: () => "Do one small, kind thing: a shower, a favourite song, something warm to drink.",
    reason: () => "You're feeling flat, and small comforts add up.",
  },
  {
    id: "comfort-good", category: "comfort", profile: "all", time: "any", light: true,
    trigger: () => true,
    text: () => "Nothing needs fixing. Eat on time, drink water, and enjoy it.",
    reason: () => "Your conditions are good.",
  },
];

const BLOCK_ORDER: Record<RecTime, number> = { morning: 0, midday: 1, afternoon: 2, evening: 3, any: -1 };
const currentBlock = (hour: number) => (hour < 12 ? 0 : hour < 15 ? 1 : hour < 18 ? 2 : 3);

const DEFAULT_ORDER: Category[] = ["safety", "sleep", "food", "movement", "workload", "comfort"];
const FOOD_FIRST_ORDER: Category[] = ["safety", "food", "sleep", "movement", "workload", "comfort"];

export function pickRecommendations(c: RecContext): Picked[] {
  const profile = c.a.profile;
  const block = currentBlock(c.hour);
  // Eating comes first when nothing has been eaten by mid-afternoon, or when they've said they can eat soon.
  const order = emptyAfterTwo(c) ? FOOD_FIRST_ORDER : DEFAULT_ORDER;

  const eligible = LIBRARY.filter(
    (rec) =>
      (rec.profile === "all" || rec.profile === profile) &&
      (rec.time === "any" || BLOCK_ORDER[rec.time] >= block) &&
      !(rec.training && c.a.pain === "pain") &&
      !(rec.light && !c.good) &&
      rec.trigger(c),
  );

  const ranked = eligible
    .map((rec, index) => ({ rec, index }))
    .sort(
      (x, y) =>
        order.indexOf(x.rec.category) - order.indexOf(y.rec.category) ||
        (y.rec.boost ?? 0) - (x.rec.boost ?? 0) ||
        // Advice written for the person's profile beats general advice in the same category.
        Number(y.rec.profile !== "all") - Number(x.rec.profile !== "all") ||
        x.index - y.index,
    );

  const counts = new Map<Category, number>();
  const topics = new Set<string>();
  const picked: Picked[] = [];
  const limit = c.good ? MAX_ON_GOOD_DAY : MAX_RECOMMENDATIONS;
  for (const { rec } of ranked) {
    if (picked.length >= limit) break;
    if ((counts.get(rec.category) ?? 0) >= MAX_PER_CATEGORY) continue;
    if (rec.topic && topics.has(rec.topic)) continue;
    if (rec.topic) topics.add(rec.topic);
    counts.set(rec.category, (counts.get(rec.category) ?? 0) + 1);
    picked.push({ id: rec.id, category: rec.category, text: rec.text(c), reason: rec.reason(c), when: rec.when });
  }
  if (picked.length === 0) {
    picked.push({
      id: "steady-as-she-goes",
      category: "comfort",
      text: "Nothing stands out. Eat on time, drink water and keep your usual rhythm.",
      reason: "No single answer is pulling your numbers down.",
    });
  }
  return picked;
}
