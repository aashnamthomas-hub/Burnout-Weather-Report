import { REPORT, clock12, type BlockId, type DayBlock } from "@/lib/report";

const W = 128;
const H = 56;
const PAD = 4;

const pointsFor = (values: number[]) =>
  values
    .map((v, i) => {
      const x = PAD + ((W - PAD * 2) * i) / (values.length - 1);
      const y = PAD + (H - PAD * 2) * (1 - v / 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

/** Hairline icons: they borrow the ink colour, never a colour of their own. */
function BlockIcon({ id }: { id: BlockId }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
      {id === "morning" && (
        <g {...common}>
          <path d="M6 22h20M10 22a6 6 0 0 1 12 0M16 8v4M7.5 13.5l2.5 2.5M24.5 13.5L22 16" />
        </g>
      )}
      {id === "midday" && (
        <g {...common}>
          <circle cx="16" cy="16" r="5" />
          <path d="M16 5v3M16 24v3M5 16h3M24 16h3M8.2 8.2l2.1 2.1M21.7 21.7l2.1 2.1M8.2 23.8l2.1-2.1M21.7 10.3l2.1-2.1" />
        </g>
      )}
      {id === "afternoon" && (
        <g {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 4v2M4 12h2M6.3 6.3l1.4 1.4M17.7 6.3l-1.4 1.4" />
          <path d="M11 26h12a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 12.2 18.5 3.7 3.7 0 0 0 11 26z" />
        </g>
      )}
      {id === "evening" && (
        <g {...common}>
          <path d="M22 20.5A9 9 0 0 1 11.5 10a9 9 0 1 0 10.5 10.5z" />
        </g>
      )}
    </svg>
  );
}

function Sparkline({ block, crashAlarm }: { block: DayBlock; crashAlarm: boolean }) {
  const dipX = (hour: number) => {
    const [start, end] = hourRange(block);
    return PAD + ((W - PAD * 2) * (hour - start)) / (end - start);
  };
  const summary = `Energy ${block.avgEnergy}, focus ${block.avgFocus}${block.dipHour ? `, dip around ${clock12(block.dipHour)}` : ""}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img" aria-label={summary}>
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.25" />
      {block.dipHour !== undefined && (
        <line
          x1={dipX(block.dipHour)}
          x2={dipX(block.dipHour)}
          y1={PAD}
          y2={H - PAD}
          stroke={crashAlarm ? "var(--warn-text)" : "currentColor"}
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
      )}
      <polyline points={pointsFor(block.focus)} fill="none" stroke="var(--line-focus)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
      <polyline points={pointsFor(block.energy)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

const BLOCK_HOURS: Record<BlockId, [number, number]> = {
  morning: [6, 12],
  midday: [12, 15],
  afternoon: [15, 18],
  evening: [18, 22],
};
const hourRange = (block: DayBlock) => BLOCK_HOURS[block.id];

type Props = { blocks: DayBlock[]; crash: number };

/** Four blocks of the day, each with its own small energy and focus curve. */
export function DayStrip({ blocks, crash }: Props) {
  const alarm = crash >= REPORT.crashAlarmFrom;
  return (
    <section aria-labelledby="day-strip-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 id="day-strip-title" className="text-2xl font-normal">The day ahead</h3>
        <p className="flex items-center gap-4 font-mono text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" stroke="currentColor" strokeWidth="1.8" /></svg>
            Energy
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" stroke="var(--line-focus)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            Focus
          </span>
        </p>
      </div>

      {/* Two by two on a phone, four across on a desktop, so nothing scrolls. */}
      <div className="mt-4 border-y border-hairline">
        <ol className="grid grid-cols-2 lg:grid-cols-4">
          {blocks.map((block) => (
            <li
              key={block.id}
              aria-current={block.status === "now" ? "time" : undefined}
              className={`flex flex-col gap-2 border-hairline p-3 sm:p-4 [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+2)]:border-l lg:[&:nth-child(n+3)]:border-t-0 ${block.status === "past" ? "text-ink-soft" : "text-ink"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xl leading-tight">{block.label}</p>
                  <p className="font-mono text-xs text-ink-soft">{block.range}</p>
                </div>
                <div className={block.status === "past" ? "opacity-50" : ""}>
                  <BlockIcon id={block.id} />
                </div>
              </div>

              <div className={block.status === "past" ? "opacity-50" : ""}>
                <Sparkline block={block} crashAlarm={alarm} />
              </div>

              <p className="font-mono text-xs tabular-nums">
                Energy {block.avgEnergy} · Focus {block.avgFocus}
              </p>

              <p className="min-h-5 font-mono text-xs">
                {block.status === "past" && <span className="text-ink-soft">past</span>}
                {block.status === "now" && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block size-2 rounded-full bg-low-sun" />
                    now
                  </span>
                )}
                {block.dipHour !== undefined && block.status !== "past" && (
                  <span className={block.status === "now" ? "ml-3" : ""} style={alarm ? { color: "var(--warn-text)" } : undefined}>
                    dip around {clock12(block.dipHour)}
                  </span>
                )}
              </p>

              {block.warning && <p className="text-sm leading-snug text-pretty">{block.warning}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
