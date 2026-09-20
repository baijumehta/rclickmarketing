"use client";

import { useState } from "react";
import { formatDuration, formatShortDate } from "@/lib/dates";

/**
 * Hours logged per day against the target line.
 *
 * This is a client component purely so it can carry a real hover tooltip.
 * The obvious alternative — an SVG <title> on each bar — cannot be used:
 * React 19 treats <title> as hoistable document metadata and pulls it out of
 * the tree, which breaks hydration on any page that renders one.
 */

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

const W = 760;
const H = 260;
const padL = 44;
const padR = 12;
const padT = 20;
const padB = 38;
const plotW = W - padL - padR;
const plotH = H - padT - padB;

export function DailyHoursChart({
  days,
  targetMinutes,
}: {
  days: { date: Date; minutes: number }[];
  targetMinutes: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxMinutes = Math.max(targetMinutes * 1.25, ...days.map((d) => d.minutes), 60);
  const yFor = (m: number) => padT + plotH - (m / maxMinutes) * plotH;

  // 2px of surface between neighbouring bars.
  const slot = plotW / Math.max(1, days.length);
  const barW = Math.max(6, Math.min(48, slot - 8));

  const ticks = [0, 2, 4, 6, 8, 10].filter((h) => h * 60 <= maxMinutes);
  const active = hovered !== null ? days[hovered] : null;

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Hours logged per day. Target ${formatDuration(targetMinutes)} a day.`}
          onMouseLeave={() => setHovered(null)}
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

          {/* The eight-hour line is the whole question, so it sits on top. */}
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
            const dim = hovered !== null && hovered !== i;

            return (
              <g key={d.date.toISOString()} opacity={dim ? 0.45 : 1}>
                {h > 0 ? (
                  <path
                    d={barPath(x, y, barW, h)}
                    fill={weekend ? "var(--color-blue-300)" : "var(--color-blue-500)"}
                  />
                ) : (
                  <rect
                    x={x}
                    y={padT + plotH - 2}
                    width={barW}
                    height={2}
                    fill="var(--color-gray-200)"
                  />
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

          {/* Invisible hit targets spanning the full column, so the pointer
              does not have to find a short bar. */}
          {days.map((d, i) => (
            <rect
              key={`hit-${d.date.toISOString()}`}
              x={padL + i * slot}
              y={padT}
              width={slot}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
          ))}
        </svg>

        {active ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[var(--radius-sm)] bg-[var(--color-navy-900)] px-3 py-2 text-white shadow-[var(--shadow-lg)]"
            style={{
              left: `${((padL + hovered! * slot + slot / 2) / W) * 100}%`,
              top: `${(Math.max(yFor(active.minutes) - 10, padT) / H) * 100}%`,
            }}
          >
            <div className="text-[12px] font-bold whitespace-nowrap">
              {formatShortDate(active.date, true)}
            </div>
            <div className="num text-[15px] font-extrabold whitespace-nowrap">
              {active.minutes === 0 ? "Nothing logged" : formatDuration(active.minutes)}
            </div>
          </div>
        ) : null}
      </div>

      <figcaption className="t-caption mt-2">
        Solid bars are weekdays; pale bars are weekend work. Hover a column for the exact figure.
      </figcaption>
    </figure>
  );
}
