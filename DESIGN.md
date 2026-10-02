# Design plan

The page is a window onto your own sky. The sky fills the screen and responds to every answer; everything else reads like the weather page of a good newspaper: hairline rules, numbers with units, short written forecasts. The sky is the only thing that moves or carries colour.

## Palette

| Name       | Hex       | Role |
|------------|-----------|------|
| Isobar     | `#17203A` | Ink and hairlines; the ground at night |
| Haze       | `#E9EDF2` | Daytime ground below the horizon (cool, not cream) |
| Low sun    | `#F2A541` | The sun, the primary action, "you are here" markers. The only warm colour |
| Warm front | `#C2413B` | Storm warnings and the crash window only |
| Cold front | `#2F5DA8` | Focus line in charts, links, day focus ring |
| Squall     | `#5A4E7C` | Burnout pressure and storm clouds |

Sky colours are not fixed: they are mixed from the scores (clear → grey with low mood → storm with high pressure).

## Typography

- **Newsreader** (variable, optical sizes): headlines, forecast prose, questions, chips. Fallback Georgia.
- **IBM Plex Mono**: readings only (`Energy 42`, `1009 hPa ↓`, `2:00 PM`, `70%`). Fallback ui-monospace.

## Layout

The sky is fixed behind every page. Questions and the headline sit on the sky; the report and footer sit on solid ground below a hairline "horizon". Desktop: question on the left, live readout on the right. 390px: readout becomes one row under the question; the day strip scrolls inside its own box, never the page.

## Principles

1. **Only the sky moves.** No cards, no shadows, no gradients outside the sky. Structure comes from hairlines and spacing.
2. **Speak like a forecaster.** Every number has a unit and a reason. Plain, specific, a little dry.
3. **Alarm has to be earned.** Red and storm clouds appear only when the scores call for them. A good day looks calm.

## Sky mapping (src/lib/sky.ts)

| Input | Visual |
|---|---|
| Low energy | Sun dims, pales and sits lower; slight dimming of the whole sky |
| Low focus | Fog bands and a fog veil |
| Low mood | Sky and clouds shift to grey, more cloud cover |
| Low social battery / racing head | Faster cloud drift and wind streaks |
| High pressure | Storm clouds build; rain above ~75 |

Reduced motion: nothing drifts, rain and twinkle stop; the sky still changes state.
