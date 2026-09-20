import { formatDuration } from "@/lib/dates";

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

/**
 * Where the hours went. Sorted by size, so the bar length carries magnitude
 * and the text label carries identity — the colour is a secondary marker only.
 * That is also what answers the palette's contrast warning: no value here is
 * conveyed by colour alone.
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
