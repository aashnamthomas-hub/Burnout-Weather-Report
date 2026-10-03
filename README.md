# Burnout Weather Report

Check your own weather before you plan the day.

You answer a few short questions about sleep, food, caffeine, movement, workload and how your head feels. You get back a personal forecast, such as "Foggy morning, 70% chance of a 1 PM crash", with plain advice for the hours ahead. The whole page is a window onto your own sky: the sun dims, fog rolls in and storm clouds build as your answers change.

Everything runs in your browser. There is no account, no server and no tracking. Your check-ins never leave your device.

## Who it's for

People aged roughly 18 to 45 whose days are shaped by how they feel:

- **Desk workers:** meetings, screens, long sitting.
- **Students:** deadlines, exams, late nights.
- **Athletes and gym-goers:** fuelling, recovery, training load.

The first question sets the kind of day (desk, study or training). It changes which questions come next, how much some answers count, and what the advice says.

## What it does

- **An adaptive check-in.** One question per screen, five to eleven of them, chosen as you go. Large tap-to-select chips, no sliders, keyboard friendly. After every answer the forecast is recomputed and the sky responds.
- **A live readout.** The four scores (energy, focus, mood, social battery) with how far the last answer moved each, and the reason: "Slept under 5 hours: energy -16".
- **A forecast that reads like a weather report.**
  - A headline built from your scores and crash probability.
  - A four-block day strip (morning, midday, afternoon, evening) with an energy and focus curve for each. The dip moves earlier as the crash probability rises.
  - Burnout pressure drawn as a barometer, with a Rising, Steady or Falling trend from your recent check-ins.
  - A storm warning, only when conditions are poor.
- **Up to four recommendations,** ordered safety and sleep, food, movement, workload, comfort. Each names its reason and, where possible, a time of day. Good days get light advice; it never invents problems.
- **"Why this forecast?"** An expandable list of every rule that fired and the points it added or took away.
- **Something for how you feel.** Films, shows, people to reach out to and gentle things to do, picked by mood. The film picks mix Hindi and international titles.
- **A share card.** A picture of today's sky, headline and four readings, plus streaks and milestones, like the stats under a run. Download it, copy the text, or use your device's share sheet. It never includes your answers.
- **A week as a climate chart** (/week). Seven days of energy, focus and burnout pressure as an SVG chart, with one sentence generated from the data ("Your crash days are the days you skip a proper meal."), a table of the numbers, a "Load sample week" button so you can see it populated, and "Clear my data".
- **Calendar awareness, privately.** An optional first step: try a sample calendar, or import an .ics file (choose it or drop it). It is parsed in the browser by a small hand-written parser that handles all-day events, time zones, basic repeating events and cancelled events. Only start and end times are used by default; "Use event titles for smarter tips" is opt-in, and titles are never saved. The forecast then uses your real meeting count and back-to-back time, tips name your actual gaps, and a thin timeline sits under the day strip.
- **Cycle awareness, opt-in and private.** Off unless you switch it on (first screen, or Settings). It never asks for gender and never predicts or estimates anything from dates: it only uses your own daily answers (where you are in your cycle, flow, cramps, what you are noticing). Every adjustment shows up in "Why this forecast?", tips use "many people find" wording, and there are separate "Remove cycle data" and "Clear my data" buttons.
- **A gentle support note.** After several very low days in a row, a short, non-diagnostic note encourages talking to someone you trust or a professional.
- **Day and night skies,** following your system setting with a manual toggle. Reduced motion is respected.

## Key decisions

**Why a weather metaphor.** People already check the weather before they leave the house, and already understand "chance of a crash" and "a front moving in". It turns a vague feeling into something specific and actionable, and it makes the page itself memorable: the sky is the only thing that moves or carries colour.

**Why adaptive questions instead of sliders.** A slider asks you to put a number on something you can't measure ("rate your energy from 1 to 10"). A question like "when did you last eat?" is easy to answer and tells the model something real. The check-in also skips what doesn't apply: no wake-up question after eight hours of sleep, no meal question if you haven't eaten, no breakfast question in the evening.

**Why rules instead of an LLM.** The forecast is a transparent, rule-based model. Every number comes from a rule you can read, and the "Why this forecast?" panel shows each one. It is instant, free, behaves the same way every time and sends nothing anywhere. All the numbers live in one `WEIGHTS` object.

**Why no account.** The brief was zero signup, zero backend, zero setup. It also means a health-adjacent app can truthfully say your data stays in your browser. Check-ins are saved in localStorage only, through one small typed helper that works even when storage is blocked.

**Why desktop first.** The design is built around a wide window onto the sky, with the question on the left and the live readout on the right. At phone widths the readout sticks to the bottom of the screen and the day strip becomes two by two, so nothing scrolls sideways.

## How AI helped build it

This project was built with Claude Code, working one phase at a time: design plan, scaffold and sky, scoring engine, adaptive check-in, forecast and recommendations, a safety and polish pass, the weekly chart, the share card, calendar awareness, cycle awareness, and a final check. The AI wrote the code and tests and ran the lint, build and browser checks; the product decisions (the idea, the audience, the rules of the model, the tone, what to cut) were made by a person. The forecast itself uses no AI at all: it is plain, readable rules.

## Honest limitations

- **The weights are tunable heuristics, not clinical.** The direction of each rule follows common sleep, nutrition and exercise guidance (short sleep, long gaps without food, dehydration and inactivity lower energy and focus; heavy workload raises pressure). The exact values are educated guesses, kept in `WEIGHTS` so they are easy to change.
- **This is not medical advice** and it cannot diagnose anything. It is a reflection tool. The support note is deliberately gentle and general.
- **Crash probability is a rule-based estimate,** not a measurement.
- **History lives in one browser.** Clear your site data, or switch browsers or devices, and it's gone.
- **Film and show suggestions are a small hand-written list.** Titles and years are real, but availability depends on where you live, so the app doesn't name streaming services.
- **The share card is an image and some text.** The app can't post for you (there is no backend); it hands the card to your device's share options.
- **The calendar parser is deliberately small.** It reads one day at a time and handles the common cases (UTC and named time zones, all-day events, daily, weekly, monthly and yearly repeats with COUNT, UNTIL, EXDATE and edited occurrences). Unusual repeat rules or unfamiliar Windows time zone names may be read as local time. Check the summary it shows before you rely on it.
- **Cycle features use only what you tell the app.** They don't predict anything, and they are not a substitute for talking to a doctor about heavy or painful periods; the app says so.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To open it on your phone, put the phone on the same Wi-Fi and visit `http://<your-computer-ip>:3000`.

Other commands:

```bash
npm run lint    # eslint
npm test        # vitest: scoring, questions, recommendations, report, insights, calendar parser, cycle, safety, share card
npm run build   # production build
```

## Deploy

It deploys to Vercel with no configuration. Push the repo to GitHub and import it at vercel.com/new, or run `npx vercel` from this folder.

## Where things live

```
src/lib/forecast.ts         scoring engine and the WEIGHTS object
src/lib/questions.ts        question bank and getNextQuestion
src/lib/report.ts           headline, day strip, barometer, storm warning
src/lib/recommendations.ts  about 45 written recommendations
src/lib/suggestions.ts      mood-based things to watch, do and listen to
src/lib/achievements.ts     streaks and milestones for the share card
src/lib/insights.ts         the one-sentence insight for the week
src/lib/calendar.ts         .ics parser, gap finding, sample calendar
src/lib/safety.ts           the gentle support note and cycle notes
src/lib/storage.ts          typed, failure-proof localStorage
src/components/             sky, check-in, forecast report, share card
```
