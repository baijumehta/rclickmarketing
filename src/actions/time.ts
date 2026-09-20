"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { businessToday, parseDateInput, parseDurationInput } from "@/lib/dates";
import { stopTimerForUser } from "@/lib/timer";

export type TimeState = { error?: string; ok?: boolean };

/**
 * Start the timer on an occurrence. One timer per person: starting a second
 * one stops the first and banks its time, which is what someone switching
 * tasks actually means.
 */
export async function startTimer(occurrenceId: string): Promise<void> {
  const user = await requireUser();

  const existing = await prisma.activeTimer.findUnique({ where: { userId: user.id } });
  if (existing?.occurrenceId === occurrenceId) return; // already running on this one
  if (existing) await stopTimerForUser(user.id);

  // Someone else's timer on the same occurrence would violate the unique key.
  await prisma.activeTimer.deleteMany({ where: { occurrenceId } });

  await prisma.$transaction([
    prisma.activeTimer.create({ data: { userId: user.id, occurrenceId } }),
    prisma.taskOccurrence.updateMany({
      where: { id: occurrenceId, status: "OPEN" },
      data: { status: "IN_PROGRESS" },
    }),
  ]);

  revalidatePath("/");
}

export async function stopTimer(): Promise<void> {
  const user = await requireUser();
  await stopTimerForUser(user.id);
  revalidatePath("/");
  revalidatePath("/summary");
}

/** Manual worklog entry — the fallback for "I forgot to start the timer". */
export async function logTime(_prev: TimeState, formData: FormData): Promise<TimeState> {
  const user = await requireUser();

  const occurrenceId = String(formData.get("occurrenceId") ?? "");
  const durationRaw = String(formData.get("duration") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const dateRaw = String(formData.get("workDate") ?? "");

  if (!occurrenceId) return { error: "Missing task." };

  const minutes = parseDurationInput(durationRaw);
  if (minutes === null) {
    return { error: "Enter a duration like 45, 1:30 or 1h 15m." };
  }
  if (minutes <= 0) return { error: "Enter more than zero minutes." };
  if (minutes > 16 * 60) return { error: "That is more than 16 hours. Split it across days." };

  const workDate = dateRaw ? parseDateInput(dateRaw) : businessToday();
  if (!workDate) return { error: "That date could not be read." };

  const occurrence = await prisma.taskOccurrence.findUnique({ where: { id: occurrenceId } });
  if (!occurrence) return { error: "That task no longer exists." };

  await prisma.$transaction([
    prisma.timeEntry.create({
      data: { occurrenceId, userId: user.id, minutes, note: note || null, source: "MANUAL", workDate },
    }),
    // Logging time against untouched work implies it has been started.
    prisma.taskOccurrence.updateMany({
      where: { id: occurrenceId, status: "OPEN" },
      data: { status: "IN_PROGRESS" },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const user = await requireUser();
  // Managers can correct anyone's log; everyone else only their own.
  const where =
    user.role === "MANAGER" ? { id: entryId } : { id: entryId, userId: user.id };

  await prisma.timeEntry.deleteMany({ where });
  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/dashboard");
}
