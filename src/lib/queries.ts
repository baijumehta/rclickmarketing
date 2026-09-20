import { Priority, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, businessToday, dateOnly, startOfMonth, startOfWeek } from "@/lib/dates";
import { HORIZON_DAYS } from "@/lib/recurrence";

export const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const occurrenceInclude = {
  task: { include: { category: true, assignee: true } },
  timeEntries: { select: { minutes: true, workDate: true, userId: true } },
} satisfies Prisma.TaskOccurrenceInclude;

export type BoardOccurrence = Prisma.TaskOccurrenceGetPayload<{
  include: typeof occurrenceInclude;
}> & {
  /** Minutes logged against this occurrence across all days. */
  totalMinutes: number;
  /** Minutes logged against it on the day being viewed. */
  minutesToday: number;
  /** The occurrence override if set, otherwise the task's priority. */
  effectivePriority: Priority;
};

function decorate(
  o: Prisma.TaskOccurrenceGetPayload<{ include: typeof occurrenceInclude }>,
  day: Date,
): BoardOccurrence {
  const dayMs = day.getTime();
  let totalMinutes = 0;
  let minutesToday = 0;
  for (const e of o.timeEntries) {
    totalMinutes += e.minutes;
    if (dateOnly(e.workDate).getTime() === dayMs) minutesToday += e.minutes;
  }
  return {
    ...o,
    totalMinutes,
    minutesToday,
    effectivePriority: o.priority ?? o.task.priority,
  };
}

/** Urgent first, then the manual sort order, then oldest due date. */
export function sortBoard(a: BoardOccurrence, b: BoardOccurrence): number {
  const p = PRIORITY_RANK[a.effectivePriority] - PRIORITY_RANK[b.effectivePriority];
  if (p !== 0) return p;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.dueDate.getTime() - b.dueDate.getTime();
}

export type DayBoard = {
  day: Date;
  overdue: BoardOccurrence[];
  today: BoardOccurrence[];
  upcoming: BoardOccurrence[];
  done: BoardOccurrence[];
  minutesLogged: number;
};

/**
 * Everything the daily workspace needs for one person on one day.
 *
 * `assigneeId` of null means "unassigned work counts too" — a task nobody has
 * been given is still work that needs doing, and hiding it is how things get
 * lost.
 */
export async function getDayBoard(userId: string, day: Date = businessToday()): Promise<DayBoard> {
  const horizonEnd = addDays(day, HORIZON_DAYS);

  const rows = await prisma.taskOccurrence.findMany({
    where: {
      task: { archivedAt: null, OR: [{ assigneeId: userId }, { assigneeId: null }] },
      OR: [
        // Anything still open up to the end of the horizon.
        { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lte: horizonEnd } },
        // Plus whatever was closed on the day being viewed, so the day reads complete.
        { status: { in: ["DONE", "SKIPPED"] }, completedAt: { not: null }, dueDate: { lte: horizonEnd } },
        // Plus anything time was logged against today, even if it closed earlier.
        { timeEntries: { some: { userId, workDate: day } } },
      ],
    },
    include: occurrenceInclude,
  });

  const decorated = rows.map((r) => decorate(r, day));
  const dayMs = day.getTime();

  const overdue: BoardOccurrence[] = [];
  const today: BoardOccurrence[] = [];
  const upcoming: BoardOccurrence[] = [];
  const done: BoardOccurrence[] = [];

  for (const o of decorated) {
    const isClosed = o.status === "DONE" || o.status === "SKIPPED";
    if (isClosed) {
      const closedToday = o.completedAt && dateOnly(o.completedAt).getTime() === dayMs;
      if (closedToday || o.minutesToday > 0) done.push(o);
      continue;
    }
    const due = dateOnly(o.dueDate).getTime();
    if (due < dayMs) overdue.push(o);
    else if (due === dayMs) today.push(o);
    else upcoming.push(o);
  }

  overdue.sort(sortBoard);
  today.sort(sortBoard);
  upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || sortBoard(a, b));
  done.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  const minutesLogged = await sumMinutes({ userId, workDate: day });

  return { day, overdue, today, upcoming, done, minutesLogged };
}

export async function sumMinutes(where: Prisma.TimeEntryWhereInput): Promise<number> {
  const agg = await prisma.timeEntry.aggregate({ where, _sum: { minutes: true } });
  return agg._sum.minutes ?? 0;
}

export async function getRunningTimer(userId: string) {
  return prisma.activeTimer.findUnique({
    where: { userId },
    include: { occurrence: { include: { task: true } } },
  });
}

// ------------------------------------------------------------- dashboard

export type DayTotal = { date: Date; minutes: number };

/** Minutes logged per day over a window, with empty days filled in as zero. */
export async function getDailyTotals(
  from: Date,
  to: Date,
  userId?: string,
): Promise<DayTotal[]> {
  const grouped = await prisma.timeEntry.groupBy({
    by: ["workDate"],
    where: { workDate: { gte: from, lte: to }, ...(userId ? { userId } : {}) },
    _sum: { minutes: true },
  });

  const byKey = new Map(
    grouped.map((g) => [dateOnly(g.workDate).getTime(), g._sum.minutes ?? 0]),
  );

  const out: DayTotal[] = [];
  for (let d = dateOnly(from); d.getTime() <= dateOnly(to).getTime(); d = addDays(d, 1)) {
    out.push({ date: d, minutes: byKey.get(d.getTime()) ?? 0 });
  }
  return out;
}

export type CategoryTotal = { name: string; color: string; minutes: number };

/** Where the hours actually went, grouped by category. */
export async function getCategoryTotals(
  from: Date,
  to: Date,
  userId?: string,
): Promise<CategoryTotal[]> {
  const entries = await prisma.timeEntry.findMany({
    where: { workDate: { gte: from, lte: to }, ...(userId ? { userId } : {}) },
    select: {
      minutes: true,
      occurrence: { select: { task: { select: { category: true } } } },
    },
  });

  const totals = new Map<string, CategoryTotal>();
  for (const e of entries) {
    const cat = e.occurrence.task.category;
    const name = cat?.name ?? "Uncategorised";
    const color = cat?.color ?? "#9aa3ae";
    const current = totals.get(name) ?? { name, color, minutes: 0 };
    current.minutes += e.minutes;
    totals.set(name, current);
  }

  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}

/**
 * Recurring work that is currently overdue. This is the number that answers
 * "what quietly fell off the list?".
 */
export async function getSlippingRecurring(day: Date = businessToday()) {
  const rows = await prisma.taskOccurrence.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      dueDate: { lt: day },
      task: { archivedAt: null, cadence: { not: "NONE" } },
    },
    include: { task: { include: { category: true, assignee: true } } },
    orderBy: { dueDate: "asc" },
  });
  return rows;
}

export function weekRange(day: Date = businessToday()) {
  const from = startOfWeek(day);
  return { from, to: addDays(from, 6) };
}

export function monthRange(day: Date = businessToday()) {
  const from = startOfMonth(day);
  return { from, to: addDays(startOfMonth(addDays(from, 40)), -1) };
}
