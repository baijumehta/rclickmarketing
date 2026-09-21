import { prisma } from "@/lib/db";
import { addDays, businessToday, formatDuration, formatLongDate, relativeDay } from "@/lib/dates";
import { getDayBoard, sortBoard, type BoardOccurrence } from "@/lib/queries";
import { getWorkdayMinutes } from "@/lib/settings";

export type ComposedSummary = {
  body: string;
  tomorrowPlan: string;
  totalMinutes: number;
  workdayMinutes: number;
};

function line(o: BoardOccurrence, withTime: boolean): string {
  const bits: string[] = [`- ${o.task.title}`];
  if (withTime && o.minutesToday > 0) bits.push(`— ${formatDuration(o.minutesToday)}`);
  if (o.task.category) bits.push(`_(${o.task.category.name})_`);
  return bits.join(" ");
}

/**
 * Build the end-of-day message. This replaces the hand-written Teams update:
 * what got done, how long each thing took, what is still open, and what is
 * lined up for tomorrow.
 */
export async function composeDailySummary(
  userId: string,
  day: Date = businessToday(),
): Promise<ComposedSummary> {
  const [board, workdayMinutes] = await Promise.all([
    getDayBoard(userId, day),
    getWorkdayMinutes(),
  ]);

  const tomorrow = addDays(day, 1);
  const sections: string[] = [];

  const done = board.done.filter((o) => o.status === "DONE");
  const skipped = board.done.filter((o) => o.status === "SKIPPED");

  // Every open occurrence, including ones due later — working ahead is normal,
  // and time logged against a future due date still has to be itemised or the
  // header total will not match the list beneath it.
  const open = [...board.overdue, ...board.today, ...board.upcoming];

  const blocked = open.filter((o) => o.status === "BLOCKED");
  const touched = open.filter((o) => o.minutesToday > 0 && o.status !== "BLOCKED");
  const untouched = [...board.overdue, ...board.today].filter((o) => o.minutesToday === 0);

  sections.push(
    `**${formatLongDate(day)}** — ${formatDuration(board.minutesLogged)} logged of ${formatDuration(workdayMinutes)}`,
  );

  if (done.length) {
    sections.push(["**Done**", ...done.map((o) => line(o, true))].join("\n"));
  }

  if (touched.length) {
    sections.push(
      ["**In progress**", ...touched.sort(sortBoard).map((o) => line(o, true))].join("\n"),
    );
  }

  // Called out separately from "in progress". Something stuck behind someone
  // else is the other way work quietly disappears, and it usually needs a
  // reader of this message to unblock it.
  if (blocked.length) {
    sections.push(
      [
        "**Blocked**",
        ...blocked
          .sort(sortBoard)
          .map((o) => `${line(o, true)}${o.notes ? ` — ${o.notes}` : ""}`),
      ].join("\n"),
    );
  }

  if (skipped.length) {
    sections.push(["**Skipped**", ...skipped.map((o) => line(o, false))].join("\n"));
  }

  // Overdue is called out explicitly — it is the thing that used to disappear.
  const stillOverdue = board.overdue.filter((o) => o.status !== "DONE");
  if (stillOverdue.length) {
    sections.push(
      [
        `**Overdue (${stillOverdue.length})**`,
        ...stillOverdue
          .sort(sortBoard)
          .slice(0, 8)
          .map((o) => `- ${o.task.title} — ${relativeDay(o.dueDate, day)}`),
      ].join("\n"),
    );
  }

  if (!done.length && !touched.length && !skipped.length && !blocked.length) {
    sections.push("_Nothing logged today._");
  }

  // Default tomorrow plan: what is due tomorrow, plus anything still overdue.
  const dueTomorrow = await prisma.taskOccurrence.findMany({
    where: {
      dueDate: tomorrow,
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      task: { archivedAt: null, OR: [{ assigneeId: userId }, { assigneeId: null }] },
    },
    include: { task: true },
    take: 10,
  });

  const planItems = [
    ...stillOverdue.sort(sortBoard).slice(0, 4).map((o) => `- ${o.task.title} (overdue)`),
    ...untouched.filter((o) => o.status !== "DONE").slice(0, 3).map((o) => `- ${o.task.title}`),
    ...dueTomorrow.map((o) => `- ${o.task.title}`),
  ];

  // Same task can appear from two sources; keep the first mention.
  const seen = new Set<string>();
  const tomorrowPlan = planItems
    .filter((item) => {
      const key = item.replace(/\s*\(overdue\)$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .join("\n");

  return {
    body: sections.join("\n\n"),
    tomorrowPlan,
    totalMinutes: board.minutesLogged,
    workdayMinutes,
  };
}

/** The final text posted to Teams: the day's body plus the tomorrow section. */
export function renderForTeams(body: string, tomorrowPlan: string | null): string {
  if (!tomorrowPlan?.trim()) return body;
  return `${body}\n\n**Tomorrow**\n${tomorrowPlan.trim()}`;
}
