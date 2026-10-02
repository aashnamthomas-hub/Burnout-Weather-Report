@AGENTS.md

# Burnout Weather Report

Consumer wellness web app (Next.js App Router, TypeScript, Tailwind v4). A short adaptive check-in produces a personal "weather forecast" for the day. Design plan: DESIGN.md.

## Working rules
- Build one phase at a time; stop after each and wait for "continue".
- End of every phase: `npm run lint`, `npm run build`, tests (once they exist), check in the browser, commit as "Phase N: ...", report in 5 lines or fewer.
- Git identity for this repo: Aashna Maria Thomas <aashna.m.thomas@gmail.com> (set locally).

## Hard constraints
- Client-side only: no backend, API routes, database, auth, LLM or external API.
- No chart, animation or calendar libraries. SVG, CSS and canvas only. No external images.
- Fonts via next/font/google with fallbacks (Newsreader, IBM Plex Mono).
- Persistence only through `src/lib/storage.ts` (try/catch everywhere; read in effects; must work when storage is blocked).
- Logic lives in pure, tested modules in `src/lib/` (forecast, questions, recommendations, insights, calendar, storage). Components in `src/components/`.
- All scoring numbers live in the exported `WEIGHTS` object in forecast.ts.
- Never give medical advice or diagnose. Footer on every page: "A reflection tool, not medical advice." Privacy line: "Your check-ins never leave this browser."
- Must deploy to Vercel with zero configuration. Desktop-first (1280px+), must work at 390px.
