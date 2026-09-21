import type { RowData } from "@/components/TaskRow";
import { formatDuration, relativeDay, toDateInput } from "@/lib/dates";
import { describeCadence } from "@/lib/recurrence";
import type { BoardOccurrence } from "@/lib/queries";

/** Flatten a board occurrence into the plain, serialisable shape the row wants. */
export function toRow(
  o: BoardOccurrence,
  day: Date,
  runningOccurrenceId: string | null,
  runningStartedAt: Date | null,
): RowData {
  return {
    id: o.id,
    taskId: o.taskId,
    title: o.task.title,
    description: o.task.description,
    status: o.status,
    notes: o.notes,
    priority: o.effectivePriority,
    categoryName: o.task.category?.name ?? null,
    categoryColor: o.task.category?.color ?? null,
    cadenceLabel: describeCadence(o.task),
    recurring: o.task.cadence !== "NONE",
    dueLabel: relativeDay(o.dueDate, day),
    overdue: o.dueDate.getTime() < day.getTime() && o.status !== "DONE" && o.status !== "SKIPPED",
    minutesToday: formatDuration(o.minutesToday),
    totalMinutes: formatDuration(o.totalMinutes),
    estimateLabel: o.task.estimateMinutes ? formatDuration(o.task.estimateMinutes) : null,
    timerStartedAt:
      runningOccurrenceId === o.id && runningStartedAt ? runningStartedAt.toISOString() : null,
    workDate: toDateInput(day),
  };
}
