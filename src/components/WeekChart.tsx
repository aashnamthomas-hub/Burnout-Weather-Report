import type { DayEntry } from "@/lib/days";
import type { ScoreKey } from "@/lib/types";

const H = 300;
const TOP = 18;
const BOTTOM = 44;
const PLOT_H = H - TOP - BOTTOM;

const SERIES: { key: Extract<ScoreKey, "energy" | "focus" | "pressure">; label: string; stroke: string; width: number; dash?: string }[] = [
  { key: "energy", label: "Energy", stroke: "currentColor", width: 2.6 },
  { key: "focus", label: "Focus", stroke: "var(--line-focus)", width: 2.2, dash: "6 5" },
  { key: "pressure", label: "Burnout pressure", stroke: "var(--line-pressure)", width: 2.6 },
];

const y = (value: number) => TOP + PLOT_H * (1 - value / 100);

/** Runs of consecutive days that have a value, so a missed day shows as a gap rather than a made-up line. */
function runs(days: DayEntry[], key: ScoreKey): { i: number; v: number }[][] {
  const out: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  days.forEach((d, i) => {
    const v = d.checkIn?.scores[key];
    if (v === undefined) {
      if (current.length) out.push(current);
      current = [];
    } else current.push({ i, v });
  });
  if (current.length) out.push(current);
  return out;
}

type Props = {
  days: DayEntry[];
  empty?: boolean;
  /** Drawing width in SVG units. A narrower chart keeps its labels readable on a phone. */
  width?: number;
  /** Hide the legend (when the same chart is drawn twice for different screen sizes). */
  legend?: boolean;
};

/** Energy, focus and burnout pressure over the last seven days, drawn as plain SVG. */
export function WeekChart({ days, empty, width = 760, legend = true }: Props) {
  const W = width;
  const LEFT = width < 500 ? 34 : 44;
  const RIGHT = width < 500 ? 14 : 20;
  const PLOT_W = W - LEFT - RIGHT;
  const count = days.length;
  const x = (i: number, n: number) => LEFT + (PLOT_W * i) / (n - 1);
  const todayIndex = count - 1;

  return (
    <div>
      {legend && (
      <ul className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs" aria-hidden="true">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <svg width="24" height="6">
              <line x1="0" x2="24" y1="3" y2="3" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label={
          empty
            ? "Empty chart. Your energy, focus and burnout pressure for the last seven days will appear here."
            : "Line chart of energy, focus and burnout pressure over the last seven days. The same numbers are in the table below."
        }
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity={tick === 0 ? 0.5 : 0.15} />
            <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.7" fontFamily="var(--font-mono), monospace">
              {tick}
            </text>
          </g>
        ))}

        {/* Today's column. */}
        <line x1={x(todayIndex, count)} x2={x(todayIndex, count)} y1={TOP} y2={TOP + PLOT_H} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 4" />

        {days.map((d, i) => (
          <text
            key={i}
            x={x(i, count)}
            y={H - 24}
            textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
            fontSize="12"
            fill="currentColor"
            fontFamily="var(--font-mono), monospace"
          >
            {d.date.toLocaleDateString("en-GB", { weekday: "short" })}
          </text>
        ))}
        {days.map((d, i) => (
          <text
            key={`n${i}`}
            x={x(i, count)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.7"
            fontFamily="var(--font-mono), monospace"
          >
            {i === todayIndex ? "today" : d.date.getDate()}
          </text>
        ))}

        {!empty &&
          SERIES.map((s) =>
            runs(days, s.key).map((run, r) => (
              <g key={`${s.key}${r}`}>
                {run.length > 1 && (
                  <polyline
                    points={run.map(({ i, v }) => `${x(i, count).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={s.stroke}
                    strokeWidth={s.width}
                    strokeDasharray={s.dash}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {run.map(({ i, v }) => (
                  <circle key={i} cx={x(i, count)} cy={y(v)} r={3.4} fill={s.stroke} />
                ))}
              </g>
            )),
          )}

        {/* "You are here": a low-sun ring on today's energy reading. */}
        {!empty && days[todayIndex].checkIn && (
          <circle
            cx={x(todayIndex, count)}
            cy={y(days[todayIndex].checkIn!.scores.energy)}
            r={8}
            fill="none"
            stroke="var(--low-sun)"
            strokeWidth="2.5"
          />
        )}
      </svg>
    </div>
  );
}
