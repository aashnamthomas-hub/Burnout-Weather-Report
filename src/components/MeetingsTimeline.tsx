import { formatDuration, formatMinutes } from "@/lib/calendar";
import type { CalendarSummary } from "@/lib/types";

const START = 6 * 60;
const END = 22 * 60;
const W = 760;
const H = 56;
const PAD = 2;

const x = (minutes: number) => PAD + ((W - PAD * 2) * (Math.min(END, Math.max(START, minutes)) - START)) / (END - START);

type Props = {
  calendar: CalendarSummary;
  /** Minutes since midnight, to mark "now". */
  nowMinutes: number;
};

/** A thin timeline of the day's meetings. The longest back-to-back run is filled; the rest are outlined. */
export function MeetingsTimeline({ calendar, nowMinutes }: Props) {
  const { blocks, gaps, longestRunStart, longestRunEnd } = calendar;
  const label =
    calendar.count === 0
      ? "No meetings today."
      : `${calendar.count} meetings, ${formatDuration(calendar.totalMinutes)} in total. ` +
        (gaps.length ? `Free gaps: ${gaps.map((g) => `${formatMinutes(g.start)} to ${formatMinutes(g.end)}`).join(", ")}.` : "No free gaps of 15 minutes or more.");

  return (
    <section aria-labelledby="timeline-title">
      <h3 id="timeline-title" className="text-2xl font-normal">Today&apos;s meetings</h3>
      <p className="mt-1 font-mono text-xs text-ink-soft">
        {calendar.count === 0 ? "No meetings" : `${calendar.count} meeting${calendar.count === 1 ? "" : "s"} · ${formatDuration(calendar.totalMinutes)}`}
        {calendar.longestRunMinutes >= 90 && ` · longest back-to-back run ${formatDuration(calendar.longestRunMinutes)}`}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={label}>
        <line x1={PAD} x2={W - PAD} y1={30} y2={30} stroke="currentColor" strokeOpacity="0.25" />
        {[6, 9, 12, 15, 18, 21].map((h) => (
          <g key={h}>
            <line x1={x(h * 60)} x2={x(h * 60)} y1={26} y2={34} stroke="currentColor" strokeOpacity="0.4" />
            <text x={x(h * 60)} y={52} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7" fontFamily="var(--font-mono), monospace">
              {formatMinutes(h * 60).replace(":00", "")}
            </text>
          </g>
        ))}
        {gaps.map((g) => (
          <rect key={g.start} x={x(g.start)} y={22} width={Math.max(2, x(g.end) - x(g.start))} height={16} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeDasharray="3 3" />
        ))}
        {blocks.map((b) => {
          const inRun = longestRunStart !== null && longestRunEnd !== null && b.start >= longestRunStart && b.end <= longestRunEnd && calendar.longestRunMinutes >= 90;
          return (
            <rect
              key={b.start}
              x={x(b.start)}
              y={20}
              width={Math.max(3, x(b.end) - x(b.start))}
              height={20}
              fill={inRun ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          );
        })}
        {nowMinutes >= START && nowMinutes <= END && (
          <g>
            <line x1={x(nowMinutes)} x2={x(nowMinutes)} y1={8} y2={44} stroke="var(--low-sun)" strokeWidth="2.5" />
            <circle cx={x(nowMinutes)} cy={8} r="4" fill="var(--low-sun)" />
          </g>
        )}
      </svg>
      {gaps.length > 0 && (
        <p className="mt-2 text-base text-ink-soft text-pretty">
          Free: {gaps.map((g) => `${formatMinutes(g.start)} to ${formatMinutes(g.end)}`).join(", ")}.
        </p>
      )}
    </section>
  );
}
