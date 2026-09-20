import { prisma } from "@/lib/db";
import { businessToday } from "@/lib/dates";

/**
 * Stop a running timer and turn the elapsed time into a time entry.
 * Returns the minutes recorded, or null if nothing was running.
 *
 * Anything under a minute is dropped rather than rounded up to one, so
 * mis-clicks do not litter the log with one-minute entries.
 */
export async function stopTimerForUser(userId: string): Promise<number | null> {
  const timer = await prisma.activeTimer.findUnique({ where: { userId } });
  if (!timer) return null;

  const endedAt = new Date();
  const minutes = Math.round((endedAt.getTime() - timer.startedAt.getTime()) / 60_000);

  await prisma.$transaction(async (tx) => {
    if (minutes >= 1) {
      await tx.timeEntry.create({
        data: {
          occurrenceId: timer.occurrenceId,
          userId,
          minutes,
          source: "TIMER",
          // Credited to the business day the timer started on, so a session
          // that runs past midnight still lands on the right day.
          workDate: businessToday(timer.startedAt),
          startedAt: timer.startedAt,
          endedAt,
        },
      });
    }
    await tx.activeTimer.delete({ where: { userId } });
  });

  return minutes >= 1 ? minutes : 0;
}
