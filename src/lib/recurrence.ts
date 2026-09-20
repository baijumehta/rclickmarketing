import { Cadence, type Task } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addDays,
  addMonths,
  businessToday,
  dateOnly,
  daysInMonth,
  nextWeekday,
} from "@/lib/dates";

/** How far ahead occurrences are materialised. Two weeks of visible runway. */
export const HORIZON_DAYS = 14;

export const CADENCE_LABEL: Record<Cadence, string> = {
  NONE: "One-off",
  DAILY: "Every day",
  WEEKDAILY: "Every weekday",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every other week",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMIANNUAL: "Twice a year",
  ANNUAL: "Yearly",
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A human sentence for the task list: "Weekly on Monday", "Monthly on the 1st". */
export function describeCadence(task: Pick<Task, "cadence" | "interval" | "anchorDay">): string {
  const { cadence, interval, anchorDay } = task;
  if (cadence === "NONE") return "One-off";

  const every = interval > 1 ? `Every ${interval} ` : "";

  switch (cadence) {
    case "DAILY":
      return interval > 1 ? `Every ${interval} days` : "Every day";
    case "WEEKDAILY":
      return "Every weekday";
    case "WEEKLY":
    case "BIWEEKLY": {
      const base = cadence === "BIWEEKLY" ? "Every other week" : interval > 1 ? `${every}weeks` : "Weekly";
      return anchorDay == null ? base : `${base} on ${WEEKDAY_NAMES[anchorDay] ?? "Monday"}`;
    }
    case "MONTHLY":
    case "QUARTERLY":
    case "SEMIANNUAL":
    case "ANNUAL": {
      const base = CADENCE_LABEL[cadence];
      if (anchorDay == null) return base;
      return `${base} on the ${ordinal(anchorDay)}`;
    }
    default:
      return CADENCE_LABEL[cadence];
  }
}

export function ordinal(n: number): string {
  if (n >= 31) return "last day";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** How many months one step of this cadence advances. 0 for day/week cadences. */
function monthStep(cadence: Cadence): number {
  switch (cadence) {
    case "MONTHLY":
      return 1;
    case "QUARTERLY":
      return 3;
    case "SEMIANNUAL":
      return 6;
    case "ANNUAL":
      return 12;
    default:
      return 0;
  }
}

/** Apply anchorDay to a month, where 31 means "last day of the month". */
function applyAnchorDay(d: Date, anchorDay: number | null): Date {
  if (anchorDay == null) return d;
  const last = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  const day = anchorDay >= 31 ? last : Math.min(anchorDay, last);
  const out = new Date(d);
  out.setUTCDate(day);
  return out;
}

/**
 * The first due date on or after `from` for this task's rule.
 * Used to seed a task that has no occurrences yet.
 */
export function firstDueOnOrAfter(
  task: Pick<Task, "cadence" | "interval" | "anchorDay">,
  from: Date,
): Date {
  const start = dateOnly(from);
  const { cadence, anchorDay } = task;

  switch (cadence) {
    case "NONE":
    case "DAILY":
      return start;

    case "WEEKDAILY":
      return nextWeekday(start);

    case "WEEKLY":
    case "BIWEEKLY": {
      if (anchorDay == null) return start;
      const delta = (anchorDay - start.getUTCDay() + 7) % 7;
      return addDays(start, delta);
    }

    default: {
      // Monthly and longer: the anchor day in this month, else the next month
      // that has it. Advancing by a whole cadence step here would be wrong —
      // a quarterly task created on 20 Sep with anchor 10 should first come
      // due on 10 Oct, not 10 Dec. The interval applies from the first
      // occurrence onward, not to finding it.
      const candidate = applyAnchorDay(start, anchorDay);
      if (candidate.getTime() >= start.getTime()) return candidate;
      return applyAnchorDay(addMonths(start, 1), anchorDay);
    }
  }
}

/** The next due date strictly after `previous`. */
export function nextDueAfter(
  task: Pick<Task, "cadence" | "interval" | "anchorDay">,
  previous: Date,
): Date {
  const { cadence, interval, anchorDay } = task;
  const step = Math.max(1, interval);
  const prev = dateOnly(previous);

  switch (cadence) {
    case "NONE":
      return prev;
    case "DAILY":
      return addDays(prev, step);
    case "WEEKDAILY":
      return nextWeekday(addDays(prev, 1));
    case "WEEKLY":
      return addDays(prev, 7 * step);
    case "BIWEEKLY":
      return addDays(prev, 14 * step);
    default: {
      const months = monthStep(cadence) * step;
      return applyAnchorDay(addMonths(prev, months), anchorDay);
    }
  }
}

/**
 * Materialise upcoming occurrences for every active recurring task.
 *
 * Idempotent: the `[taskId, dueDate]` unique constraint means running this
 * twice is a no-op, so it is safe to call on page load as well as from cron.
 *
 * Note it deliberately does *not* skip a cycle when the previous one is still
 * open. If SEO went unchecked in September, October's row appears anyway and
 * both sit there overdue. Hiding the backlog is the failure mode this whole
 * app exists to fix.
 */
export async function ensureOccurrences(horizonDays = HORIZON_DAYS): Promise<number> {
  const today = businessToday();
  const horizon = addDays(today, horizonDays);

  const tasks = await prisma.task.findMany({
    where: { archivedAt: null, cadence: { not: "NONE" } },
    include: {
      occurrences: {
        orderBy: { dueDate: "desc" },
        take: 1,
        select: { dueDate: true },
      },
    },
  });

  const rows: { taskId: string; dueDate: Date; priority: null }[] = [];

  for (const task of tasks) {
    const last = task.occurrences[0]?.dueDate;
    let due = last
      ? nextDueAfter(task, last)
      : firstDueOnOrAfter(task, task.startDate > today ? task.startDate : today);

    // Bounded so a misconfigured task can never spin here.
    for (let i = 0; i < 400; i++) {
      if (due.getTime() > horizon.getTime()) break;
      if (task.endDate && due.getTime() > dateOnly(task.endDate).getTime()) break;
      rows.push({ taskId: task.id, dueDate: due, priority: null });
      const next = nextDueAfter(task, due);
      if (next.getTime() <= due.getTime()) break; // guard against a rule that cannot advance
      due = next;
    }
  }

  if (rows.length === 0) return 0;

  const result = await prisma.taskOccurrence.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}
