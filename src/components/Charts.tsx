import { formatDuration, formatShortDate } from "@/lib/dates";

/**
 * Categorical palette. The Right Click ramps are essentially one hue, which
 * cannot carry seven distinct categories, so these are snapped-to-passing
 * steps anchored on brand blue. Validated for lightness band, chroma floor,
 * CVD separation and normal-vision separation against a light surface.
 * The contrast warning on the ochre and teal steps is answered by the visible
 * text label beside every bar.
 */
export const CATEGORY_PALETTE = [
  "#0098d5",
  "#e2603f",
  "#a563c9",
  "#17a673",
  "#e0961c",
  "#6b5bd2",
  "#00a3ad",
] as const;

/** A bar with a 4px rounded top, anchored flat to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.min(r, h, w / 2);
  if (h <= 0) return "";
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    "Z",
  ].join(" ");
}

export function DailyHoursChart({
  days,
  targetMinutes,
}: {
  days: { date: Date; minutes: number }[];
  targetMinutes: number;
}) {
  const W = 760;
  const H = 260;
  const padL = 44;
  const padR = 12;
  const padT = 20;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxMinutes = Math.max(targetMinutes * 1.25, ...days.map((d) => d.minutes), 60);
  const yFor = (m: number) => padT + plotH - (m / maxMinutes) * plotH;

  // 2px of surface between neighbouring bars.
  const slot = plotW / Math.max(1, days.length);
  const barW = Math.max(6, Math.min(48, slot - 8));

  const ticks = [0, 2, 4, 6, 8, 10].filter((h) => h * 60 <= maxMinutes);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Hours logged per day. Target ${formatDuration(targetMinutes)} a day.`}
      >
        {/* Recessive grid */}
        {ticks.map((h) => (
          <g key={h}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yFor(h * 60)}
              y2={yFor(h * 60)}
              stroke="var(--color-border-1)"
              strokeWidth={1}
            />
            <text
              x={padL - 10}
              y={yFor(h * 60) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-fg-3)"
            >
              {h}h
            </text>
          </g>
        ))}

        {/* The eight-hour line is the whole question, so it is drawn on top. */}
        <line
          x1={padL}
          x2={W - padR}
          y1={yFor(targetMinutes)}
          y2={yFor(targetMinutes)}
          stroke="var(--color-navy-900)"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <text
          x={W - padR}
          y={yFor(targetMinutes) - 7}
          textAnchor="end"
          fontSize={11}
          fontWeight={700}
          fill="var(--color-navy-900)"
        >
          Target {formatDuration(targetMinutes)}
        </text>

        {days.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const y = yFor(d.minutes);
          const h = padT + plotH - y;
          const weekend = d.date.getUTCDay() === 0 || d.date.getUTCDay() === 6;

          return (
            <g key={d.date.toISOString()}>
              {h > 0 ? (
                <path
                  d={barPath(x, y, barW, h)}
                  fill={weekend ? "var(--color-blue-300)" : "var(--color-blue-500)"}
                >
                  <title>
                    {formatShortDate(d.date)} — {formatDuration(d.minutes)}
                  </title>
                </path>
              ) : (
                <rect x={x} y={padT + plotH - 2} width={barW} height={2} fill="var(--color-gray-200)">
                  <title>{formatShortDate(d.date)} — nothing logged</title>
                </rect>
              )}
              <text
                x={x + barW / 2}
                y={H - padB + 16}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-fg-3)"
              >
                {formatShortDate(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="t-caption mt-2">
        Solid bars are weekdays; pale bars are weekend work. Hover a bar for the exact figure.
      </figcaption>
    </figure>
  );
}

/**
 * Where the hours went. Sorted by size, so the bar length carries magnitude
 * and the text label carries identity — the colour is a secondary marker only.
 */
export function CategoryBars({
  rows,
}: {
  rows: { name: string; color: string; minutes: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const total = rows.reduce((s, r) => s + r.minutes, 0);

  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const pct = total > 0 ? Math.round((r.minutes / total) * 100) : 0;
        const color = r.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
        return (
          <div key={r.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <span className="t-small inline-flex items-center gap-2 font-semibold text-[var(--color-fg-1)]">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {r.name}
              </span>
              <span className="t-caption num shrink-0">
                <span className="font-bold text-[var(--color-fg-1)]">
                  {formatDuration(r.minutes)}
                </span>{" "}
                · {pct}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-gray-100)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.minutes / max) * 100}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
