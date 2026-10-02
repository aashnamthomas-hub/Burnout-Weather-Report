// Shared data types for check-ins. Answer values are stable string ids so they
// can be stored in localStorage and compared across versions.

export type Profile = "desk" | "study" | "training";

export type SleepHours = "under5" | "5to6" | "6to7" | "7to8" | "8plus";
export type WakeFeeling = "rested" | "okay" | "groggy" | "wrecked";
export type LastMeal = "within2h" | "2to4h" | "4to6h" | "6hplus" | "nothingYet";
export type MealType = "balanced" | "carbs" | "snack" | "coffee" | "skipped";
export type Water = "none" | "1to3" | "4plus";
export type Caffeine = "none" | "1" | "2" | "3plus";
export type CaffeineTiming = "beforeNoon" | "afterNoon";
export type Movement = "today" | "yesterday" | "2to3days" | "cantRemember";
export type Meetings = "0" | "1to2" | "3to5" | "6plus";
export type Deadlines = "none" | "1" | "2" | "3plus";
export type TrainingLoad = "rest" | "easy" | "hard" | "brutal";
export type Head = "clear" | "busy" | "racing" | "foggy" | "flat";

// Follow-up answers. These steer advice (Phase 4) rather than the scores.
export type SleepNights = "0to1" | "2to3" | "4plus";
export type SleepBlocker = "work" | "screens" | "mind" | "other";
export type YesNo = "yes" | "no";
export type FirstDeadline = "today" | "tomorrow" | "dayAfter";
export type Pain = "soreness" | "pain";
export type RacingAbout = "work" | "exams" | "personal" | "nothing";
export type MovementBlocker = "time" | "energy" | "weather" | "havent";
/** An optional question the person chose not to answer is stored as "skipped". */
export type Weighing = "yes" | "no" | "skipped";
export type Screens = "likely" | "unlikely";
export type Tomorrow = "light" | "normal" | "packed";

/** Everything is optional: scores are recomputed after every single answer. */
export type Answers = {
  profile?: Profile;
  sleep?: SleepHours;
  wake?: WakeFeeling;
  lastMeal?: LastMeal;
  mealType?: MealType;
  water?: Water;
  caffeine?: Caffeine;
  caffeineTiming?: CaffeineTiming;
  movement?: Movement;
  meetings?: Meetings;
  deadlines?: Deadlines;
  training?: TrainingLoad;
  head?: Head;
  avoidPeople?: boolean;
  sleepNights?: SleepNights;
  sleepBlocker?: SleepBlocker;
  canEat?: YesNo;
  jittery?: YesNo;
  gaps?: YesNo;
  skippable?: YesNo;
  firstDeadline?: FirstDeadline;
  pain?: Pain;
  racingAbout?: RacingAbout;
  movementBlocker?: MovementBlocker;
  weighing?: Weighing;
  screens?: Screens;
  tomorrow?: Tomorrow;
};

export type ScoreKey = "energy" | "focus" | "mood" | "social" | "pressure";

export type Scores = Record<ScoreKey, number>;

export type Trend = "Rising" | "Steady" | "Falling";

/** A saved check-in. `date` is an ISO timestamp. */
export type CheckIn = {
  /** True for the demo week from "Load sample week"; dropped as soon as a real check-in is saved. */
  sample?: boolean;
  date: string;
  answers: Answers;
  scores: Scores;
  crash: number;
};
