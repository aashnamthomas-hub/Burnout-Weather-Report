import type { Report } from "@/lib/report";

const CX = 120;
const CY = 112;
const R = 88;

/** Point on the dial for a 0-100 value: 0 at the far left, 100 at the far right. */
function polar(value: number, radius: number) {
  const angle = Math.PI - (value / 100) * Math.PI;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius: number) {
  const a = polar(from, radius);
  const b = polar(to, radius);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${radius} ${radius} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

const TREND_MARK = { Rising: "▲", Steady: "–", Falling: "▼" } as const;

/** Burnout pressure drawn like an old wall barometer: Fair, Change, Stormy. */
export function PressureGauge({ pressure }: { pressure: Report["pressure"] }) {
  const { value, trend, zone, note } = pressure;
  const needleTip = polar(value, R - 14);
  // Zone names sit under the dial so the needle never crosses them.
  const labels = [
    { text: "Fair", x: 34, anchor: "middle" },
    { text: "Change", x: 120, anchor: "middle" },
    { text: "Stormy", x: 206, anchor: "middle" },
  ] as const;

  return (
    <section aria-labelledby="pressure-title">
      <h3 id="pressure-title" className="text-2xl font-normal">Burnout pressure</h3>

      <svg
        viewBox="0 0 240 134"
        className="mt-3 w-full max-w-xs"
        role="img"
        aria-label={`Burnout pressure ${value} out of 100, ${zone.toLowerCase()}, ${trend.toLowerCase()}`}
      >
        <path d={arc(0, 100, R)} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="8" />
        <path d={arc(0, Math.max(value, 0.5), R)} fill="none" stroke="var(--line-pressure)" strokeWidth="8" />
        {Array.from({ length: 11 }, (_, i) => i * 10).map((tick) => {
          const inner = polar(tick, R + 8);
          const outer = polar(tick, R + (tick % 50 === 0 ? 16 : 12));
          return <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="currentColor" strokeOpacity="0.5" />;
        })}
        {labels.map(({ text, x, anchor }) => {
          return (
            <text key={text} x={x} y={CY + 18} textAnchor={anchor} fontSize="9" fill="currentColor" fillOpacity="0.7" fontFamily="var(--font-mono), monospace">
              {text}
            </text>
          );
        })}
        <line x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="6" fill="var(--low-sun)" stroke="currentColor" strokeWidth="1.2" />
      </svg>

      <p className="mt-1 font-mono text-3xl tabular-nums">
        {value}
        <span className="ml-3 text-base text-ink-soft">
          {zone} {TREND_MARK[trend]} {trend}
        </span>
      </p>
      <p className="mt-2 max-w-xs text-base text-ink-soft text-pretty">{note}</p>
    </section>
  );
}
