// "Something for how you feel": a small written library of things to watch,
// people to reach out to and gentle things to do, picked by mood. No external
// service, no tracking. These are nudges, not treatment: "many people find".

import type { Answers, Scores } from "./types";

export type Feeling = "low" | "flat" | "racing" | "drained" | "good" | "steady";
export type SuggestionKind = "watch" | "people" | "do" | "listen";

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  /** Which feelings this suits. */
  feelings: Feeling[];
  title: string;
  note: string;
  /** Shown in mono, e.g. "Film · 2017 · English". */
  meta?: string;
  when: string;
  /** Watch picks are mixed between Indian and international titles. */
  origin?: "india" | "intl";
  /** People ideas that need no talking, safe when the social battery is low. */
  quiet?: boolean;
};

export type SuggestionContext = {
  answers: Answers;
  scores: Scores;
  good: boolean;
  /** Varies the picks from day to day while staying deterministic. */
  seed: number;
};

export const SUGGESTION_RULES = {
  lowMood: 45,
  drainedEnergy: 40,
  drainedSocial: 40,
  quietSocial: 35,
  count: { watch: 2, people: 1, do: 1 },
} as const;

export const LIBRARY: Suggestion[] = [
  /* ---------- Watch: feel-good, for a low day ---------- */
  { id: "w-paddington2", kind: "watch", feelings: ["low", "drained"], origin: "intl", title: "Paddington 2", meta: "Film · 2017 · English", when: "Tonight", note: "Gentle, funny and kind all the way through. Hard to stay low for long." },
  { id: "w-chhichhore", kind: "watch", feelings: ["low"], origin: "india", title: "Chhichhore", meta: "Film · 2019 · Hindi", when: "Tonight", note: "Friends, hostel chaos and a reminder that a rough patch isn't the whole story." },
  { id: "w-tedlasso", kind: "watch", feelings: ["low", "flat"], origin: "intl", title: "Ted Lasso", meta: "Series · 2020 · English", when: "Tonight", note: "Warm, optimistic and easy to watch one episode at a time." },
  { id: "w-zndm", kind: "watch", feelings: ["low", "good"], origin: "india", title: "Zindagi Na Milegi Dobara", meta: "Film · 2011 · Hindi", when: "Tonight", note: "Three friends, one road trip, and a lot of sunshine." },
  { id: "w-intern", kind: "watch", feelings: ["low", "steady"], origin: "intl", title: "The Intern", meta: "Film · 2015 · English", when: "Tonight", note: "Soft, reassuring and quietly funny. Good company on a heavy day." },
  { id: "w-jwm", kind: "watch", feelings: ["low", "flat"], origin: "india", title: "Jab We Met", meta: "Film · 2007 · Hindi", when: "Tonight", note: "A cheerful train ride that's hard to watch without smiling." },
  { id: "w-schitts", kind: "watch", feelings: ["low", "drained"], origin: "intl", title: "Schitt's Creek", meta: "Series · 2015 · English", when: "Tonight", note: "Starts silly and ends up kind. Short episodes, no effort needed." },
  { id: "w-3idiots", kind: "watch", feelings: ["low", "racing"], origin: "india", title: "3 Idiots", meta: "Film · 2009 · Hindi", when: "Tonight", note: "Pressure, exams and friendship, handled with humour." },
  { id: "w-lms", kind: "watch", feelings: ["low", "steady"], origin: "intl", title: "Little Miss Sunshine", meta: "Film · 2006 · English", when: "Tonight", note: "A chaotic family road trip that's funnier and warmer than it sounds." },

  /* ---------- Watch: gentle, for a flat or drained day ---------- */
  { id: "w-piku", kind: "watch", feelings: ["flat", "drained"], origin: "india", title: "Piku", meta: "Film · 2015 · Hindi", when: "Tonight", note: "Small, funny and low-key. It asks nothing of you." },
  { id: "w-panchayat", kind: "watch", feelings: ["flat", "drained", "racing"], origin: "india", title: "Panchayat", meta: "Series · 2020 · Hindi", when: "Tonight", note: "A slow village, kind people and very low stakes." },
  { id: "w-gullak", kind: "watch", feelings: ["flat", "drained"], origin: "india", title: "Gullak", meta: "Series · 2019 · Hindi", when: "Tonight", note: "Short family stories that feel like home." },
  { id: "w-soul", kind: "watch", feelings: ["flat"], origin: "intl", title: "Soul", meta: "Film · 2020 · English", when: "Tonight", note: "About noticing ordinary good things. Beautiful to look at, too." },
  { id: "w-queen", kind: "watch", feelings: ["flat", "steady"], origin: "india", title: "Queen", meta: "Film · 2013 · Hindi", when: "Tonight", note: "A quiet kind of comeback story." },
  { id: "w-bakeoff", kind: "watch", feelings: ["flat", "drained"], origin: "intl", title: "The Great British Bake Off", meta: "Series · 2010 · English", when: "Tonight", note: "Cake, kindness and nobody being truly unpleasant." },

  /* ---------- Watch: calming, for a racing head ---------- */
  { id: "w-octopus", kind: "watch", feelings: ["racing"], origin: "intl", title: "My Octopus Teacher", meta: "Documentary · 2020 · English", when: "Tonight", note: "Slow, quiet and absorbing. Good for a busy mind." },
  { id: "w-ourplanet", kind: "watch", feelings: ["racing"], origin: "intl", title: "Our Planet", meta: "Documentary · 2019 · English", when: "Tonight", note: "Wide landscapes and slow pacing. Let your head catch up." },
  { id: "w-bobross", kind: "watch", feelings: ["racing", "drained"], origin: "intl", title: "The Joy of Painting", meta: "Series · 1983 · English", when: "Tonight", note: "A calm voice, a brush and a happy little tree." },
  { id: "w-dilchahta", kind: "watch", feelings: ["racing", "steady"], origin: "india", title: "Dil Chahta Hai", meta: "Film · 2001 · Hindi", when: "Tonight", note: "Easygoing and unhurried, with great music." },

  /* ---------- Watch: for a good day ---------- */
  { id: "w-yjhd", kind: "watch", feelings: ["good", "steady"], origin: "india", title: "Yeh Jawaani Hai Deewani", meta: "Film · 2013 · Hindi", when: "Tonight", note: "Mountains, friends and a reason to go out and do something." },
  { id: "w-mitty", kind: "watch", feelings: ["good", "steady"], origin: "intl", title: "The Secret Life of Walter Mitty", meta: "Film · 2013 · English", when: "Tonight", note: "A good-day film: it'll make you want to go somewhere." },
  { id: "w-wakeupsid", kind: "watch", feelings: ["good", "steady"], origin: "india", title: "Wake Up Sid", meta: "Film · 2009 · Hindi", when: "Tonight", note: "Easy, warm, a little wistful." },

  /* ---------- People ---------- */
  { id: "p-family-call", kind: "people", feelings: ["low", "flat", "steady"], title: "Call a family member", note: "Ten minutes is plenty. Ask about their day before yours.", when: "Today" },
  { id: "p-friend-text", kind: "people", feelings: ["low", "flat", "drained", "steady"], quiet: true, title: "Message a friend you haven't spoken to lately", note: "One line is enough: \"Was thinking of you.\" No reply needed.", when: "Today" },
  { id: "p-voice-note", kind: "people", feelings: ["low", "drained", "flat"], quiet: true, title: "Send a voice note instead of calling", note: "You stay connected without needing to hold a conversation.", when: "Today" },
  { id: "p-meal-together", kind: "people", feelings: ["low", "flat", "good"], title: "Eat one meal with someone", note: "Family, flatmates or a friend. Many people find a shared meal lifts the mood.", when: "Dinner" },
  { id: "p-walk-friend", kind: "people", feelings: ["racing", "low", "good"], title: "Take a friend for a walk", note: "Walking side by side makes it easier to talk, or not talk.", when: "Today" },
  { id: "p-sit-near", kind: "people", feelings: ["drained", "low"], quiet: true, title: "Sit in the same room as someone you like", note: "No talking required. Being near people can help on its own.", when: "This evening" },
  { id: "p-celebrate", kind: "people", feelings: ["good"], title: "Tell someone about something good", note: "Good news lasts longer when you share it.", when: "Today" },
  { id: "p-plan", kind: "people", feelings: ["good", "steady"], title: "Make a plan for the weekend with a friend", note: "Something to look forward to is worth having.", when: "Today" },

  /* ---------- Do ---------- */
  { id: "d-outside", kind: "do", feelings: ["low", "flat", "racing", "steady"], title: "Ten minutes outside", note: "Daylight and a walk, no phone. Many people find it settles the mind.", when: "Next hour" },
  { id: "d-warm-food", kind: "do", feelings: ["low", "drained", "flat"], title: "Make something warm and simple", note: "Khichdi, a cup of chai with a snack, or dal-chawal. Looking after yourself counts.", when: "Today" },
  { id: "d-shower", kind: "do", feelings: ["low", "flat", "drained"], title: "Shower and change into fresh clothes", note: "A small reset that takes ten minutes.", when: "Next hour" },
  { id: "d-three-things", kind: "do", feelings: ["low", "racing"], title: "Write down three things that went okay", note: "They can be tiny. It helps to see them on paper.", when: "This evening" },
  { id: "d-tidy", kind: "do", feelings: ["flat", "low"], title: "Tidy one small corner", note: "A desk, a shelf or a bag. One visible win is enough.", when: "Next hour" },
  { id: "d-breath", kind: "do", feelings: ["racing"], title: "Slow breathing for two minutes", note: "In for four, out for six. It's a quick way to bring things down a notch.", when: "Now" },
  { id: "d-stretch", kind: "do", feelings: ["racing", "drained", "flat"], title: "Ten minutes of gentle stretching", note: "Slow and easy, nothing that needs effort.", when: "This evening" },
  { id: "d-early-night", kind: "do", feelings: ["drained"], title: "Give yourself an early night", note: "A low battery usually needs rest more than it needs a fix.", when: "Tonight" },
  { id: "d-new-thing", kind: "do", feelings: ["good", "steady"], title: "Try one thing you've been putting off", note: "Your conditions are good, so use them on something you care about.", when: "Today" },
  { id: "d-cook", kind: "do", feelings: ["good"], title: "Cook something you enjoy", note: "A day with energy is a good day for a proper meal.", when: "Dinner" },

  /* ---------- Listen ---------- */
  { id: "l-old-album", kind: "listen", feelings: ["low", "flat"], title: "Put on an album you loved years ago", note: "Familiar music is a quick way back to a better mood.", when: "Now" },
  { id: "l-slow-music", kind: "listen", feelings: ["racing", "drained"], title: "Slow instrumental music", note: "Piano, ambient or classical. Keep the volume low.", when: "Now" },
  { id: "l-comedy", kind: "listen", feelings: ["low", "drained", "flat"], title: "A comedy podcast or stand-up set", note: "Laughing is a small, quick lift.", when: "Now" },
  { id: "l-upbeat", kind: "listen", feelings: ["good"], title: "An upbeat playlist for the commute or the gym", note: "Ride the good energy.", when: "Now" },
];

export function feelingFor(answers: Answers, scores: Scores, good: boolean): Feeling {
  if (answers.head === "flat") return "flat";
  if (answers.head === "racing") return "racing";
  if (scores.mood < SUGGESTION_RULES.lowMood) return "low";
  if (scores.energy < SUGGESTION_RULES.drainedEnergy || scores.social < SUGGESTION_RULES.drainedSocial) return "drained";
  if (good) return "good";
  return "steady";
}

export const FEELING_HEADINGS: Record<Feeling, string> = {
  low: "For a low day",
  flat: "For a flat day",
  racing: "To slow things down",
  drained: "For a drained day",
  good: "To make the most of today",
  steady: "If you want something nice",
};

const pick = <T,>(items: T[], seed: number, offset = 0): T | undefined =>
  items.length === 0 ? undefined : items[(seed + offset) % items.length];

export function pickSuggestions(c: SuggestionContext): { feeling: Feeling; items: Suggestion[] } {
  const feeling = feelingFor(c.answers, c.scores, c.good);
  const fits = LIBRARY.filter((s) => s.feelings.includes(feeling));
  const wantsQuiet = c.answers.avoidPeople === true || c.scores.social < SUGGESTION_RULES.quietSocial;
  const items: Suggestion[] = [];

  // Two things to watch, one Indian and one international where possible.
  const watch = fits.filter((s) => s.kind === "watch");
  const india = pick(watch.filter((s) => s.origin === "india"), c.seed);
  const intl = pick(watch.filter((s) => s.origin === "intl"), c.seed);
  items.push(...[india, intl].filter((s): s is Suggestion => Boolean(s)));
  if (items.length < SUGGESTION_RULES.count.watch) {
    const extra = pick(watch.filter((s) => !items.includes(s)), c.seed, 1);
    if (extra) items.push(extra);
  }

  // One person-focused idea; when the social battery is low, only ones that need no talking.
  const people = fits.filter((s) => s.kind === "people" && (!wantsQuiet || s.quiet));
  const person = pick(people, c.seed);
  if (person) items.push(person);

  const things = fits.filter((s) => s.kind === "do" || s.kind === "listen");
  const thing = pick(things, c.seed, 1);
  if (thing) items.push(thing);

  return { feeling, items };
}

/** Day of the year in local time, used to vary suggestions from day to day. */
export function daySeed(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}
