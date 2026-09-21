"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Cadence, OccurrenceStatus, Priority } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { businessToday, parseDateInput } from "@/lib/dates";
import { ensureOccurrences, firstDueOnOrAfter } from "@/lib/recurrence";

const TaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a name.").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  categoryId: z.string().trim().optional().or(z.literal("")),
  priority: z.nativeEnum(Priority),
  cadence: z.nativeEnum(Cadence),
  interval: z.coerce.number().int().min(1).max(52).default(1),
  anchorDay: z.coerce.number().int().min(0).max(31).optional(),
  startDate: z.string().trim().min(1, "Pick a start date."),
  endDate: z.string().trim().optional().or(z.literal("")),
  estimateMinutes: z.coerce.number().int().min(0).max(10_000).optional(),
  assigneeId: z.string().trim().optional().or(z.literal("")),
});

export type ActionState = { error?: string; ok?: boolean };

function readForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  // Empty optional numbers arrive as "" and would fail coercion.
  for (const key of ["interval", "anchorDay", "estimateMinutes"] as const) {
    if (raw[key] === "") delete raw[key];
  }
  return raw;
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = TaskSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  const startDate = parseDateInput(d.startDate);
  if (!startDate) return { error: "That start date could not be read." };
  const endDate = d.endDate ? parseDateInput(d.endDate) : null;
  if (endDate && endDate < startDate) return { error: "The end date is before the start date." };

  const task = await prisma.task.create({
    data: {
      title: d.title,
      description: d.description || null,
      categoryId: d.categoryId || null,
      priority: d.priority,
      cadence: d.cadence,
      interval: d.interval,
      anchorDay: d.cadence === "NONE" ? null : (d.anchorDay ?? null),
      startDate,
      endDate,
      estimateMinutes: d.estimateMinutes ?? null,
      assigneeId: d.assigneeId || null,
      createdById: user.id,
    },
  });

  if (task.cadence === "NONE") {
    // A one-off is its own single occurrence, due on the start date.
    await prisma.taskOccurrence.create({ data: { taskId: task.id, dueDate: startDate } });
  } else {
    // Seed the first occurrence immediately so it is visible right away, then
    // let the generator fill the rest of the horizon.
    const firstDue = firstDueOnOrAfter(task, startDate);
    if (!endDate || firstDue <= endDate) {
      await prisma.taskOccurrence.create({
        data: { taskId: task.id, dueDate: firstDue },
      });
    }
    await ensureOccurrences();
  }

  revalidatePath("/");
  revalidatePath("/backlog");
  redirect(`/tasks/${task.id}`);
}

export async function updateTask(
  taskId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = TaskSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  const startDate = parseDateInput(d.startDate);
  if (!startDate) return { error: "That start date could not be read." };
  const endDate = d.endDate ? parseDateInput(d.endDate) : null;
  if (endDate && endDate < startDate) return { error: "The end date is before the start date." };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: d.title,
      description: d.description || null,
      categoryId: d.categoryId || null,
      priority: d.priority,
      cadence: d.cadence,
      interval: d.interval,
      anchorDay: d.cadence === "NONE" ? null : (d.anchorDay ?? null),
      startDate,
      endDate,
      estimateMinutes: d.estimateMinutes ?? null,
      assigneeId: d.assigneeId || null,
    },
  });

  // The rule may have changed. Drop untouched future occurrences and rebuild,
  // leaving anything already worked on or closed exactly as it is.
  await prisma.taskOccurrence.deleteMany({
    where: {
      taskId,
      status: "OPEN",
      dueDate: { gt: businessToday() },
      timeEntries: { none: {} },
    },
  });
  await ensureOccurrences();

  revalidatePath("/");
  revalidatePath("/backlog");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function archiveTask(taskId: string): Promise<void> {
  await requireUser();
  await prisma.task.update({ where: { id: taskId }, data: { archivedAt: new Date() } });
  // Clear future work, keep history.
  await prisma.taskOccurrence.deleteMany({
    where: { taskId, status: "OPEN", dueDate: { gte: businessToday() }, timeEntries: { none: {} } },
  });
  revalidatePath("/");
  revalidatePath("/backlog");
  redirect("/backlog");
}

export async function restoreTask(taskId: string): Promise<void> {
  await requireUser();
  await prisma.task.update({ where: { id: taskId }, data: { archivedAt: null } });
  await ensureOccurrences();
  revalidatePath("/");
  revalidatePath("/backlog");
}

export async function setOccurrenceStatus(
  occurrenceId: string,
  status: OccurrenceStatus,
): Promise<void> {
  const user = await requireUser();
  const closing = status === "DONE" || status === "SKIPPED";

  const occurrence = await prisma.taskOccurrence.update({
    where: { id: occurrenceId },
    data: {
      status,
      completedAt: closing ? new Date() : null,
      completedById: closing ? user.id : null,
    },
    include: { task: true },
  });

  // Closing a running task should stop its timer rather than leave it ticking.
  if (closing) {
    const timer = await prisma.activeTimer.findUnique({ where: { occurrenceId } });
    if (timer) await stopTimerInternal(timer.userId);
  }

  // Finishing one cycle is what schedules the next.
  if (closing && occurrence.task.cadence !== "NONE") {
    await ensureOccurrences();
  }

  revalidatePath("/");
  revalidatePath("/backlog");
  revalidatePath(`/tasks/${occurrence.taskId}`);
}

/**
 * Block a piece of work, with the reason attached. A blocked task with no
 * stated reason is the thing this whole app exists to stop — in a month
 * nobody remembers what it was waiting on.
 */
export async function blockOccurrence(occurrenceId: string, reason: string): Promise<void> {
  await requireUser();

  const timer = await prisma.activeTimer.findUnique({ where: { occurrenceId } });
  if (timer) await stopTimerInternal(timer.userId);

  const occurrence = await prisma.taskOccurrence.update({
    where: { id: occurrenceId },
    data: {
      status: "BLOCKED",
      notes: reason.trim() || null,
      completedAt: null,
      completedById: null,
    },
  });

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath(`/tasks/${occurrence.taskId}`);
}

/**
 * Clear a block. The resolution is kept on the occurrence rather than thrown
 * away, so the task history says how it got unstuck.
 */
export async function unblockOccurrence(
  occurrenceId: string,
  resolution: string,
): Promise<void> {
  await requireUser();

  const trimmed = resolution.trim();
  const occurrence = await prisma.taskOccurrence.update({
    where: { id: occurrenceId },
    data: {
      status: "IN_PROGRESS",
      notes: trimmed ? `Unblocked: ${trimmed}` : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath(`/tasks/${occurrence.taskId}`);
}

export async function setOccurrencePriority(
  occurrenceId: string,
  priority: Priority | null,
): Promise<void> {
  await requireUser();
  await prisma.taskOccurrence.update({ where: { id: occurrenceId }, data: { priority } });
  revalidatePath("/");
}

export async function setOccurrenceNotes(occurrenceId: string, notes: string): Promise<void> {
  await requireUser();
  await prisma.taskOccurrence.update({
    where: { id: occurrenceId },
    data: { notes: notes.trim() || null },
  });
  revalidatePath("/");
}

/** Push an occurrence to a new date without losing that it was late. */
export async function rescheduleOccurrence(occurrenceId: string, dateValue: string): Promise<void> {
  await requireUser();
  const dueDate = parseDateInput(dateValue);
  if (!dueDate) return;

  const existing = await prisma.taskOccurrence.findUnique({ where: { id: occurrenceId } });
  if (!existing) return;

  // The unique [taskId, dueDate] means we cannot land on a date already taken.
  const clash = await prisma.taskOccurrence.findUnique({
    where: { taskId_dueDate: { taskId: existing.taskId, dueDate } },
  });
  if (clash && clash.id !== occurrenceId) return;

  await prisma.taskOccurrence.update({ where: { id: occurrenceId }, data: { dueDate } });
  revalidatePath("/");
}

// Shared with the time actions so closing a task can stop its timer.
export async function stopTimerInternal(userId: string): Promise<void> {
  const { stopTimerForUser } = await import("@/lib/timer");
  await stopTimerForUser(userId);
}
