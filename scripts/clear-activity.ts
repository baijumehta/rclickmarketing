/**
 * Wipe activity back to a clean slate, keeping people, roles, settings and
 * categories. Use before handing the app to someone for real.
 *
 *   npm run db:clear
 *
 * Removes: every time entry, every occurrence, every saved summary, any
 * running timer, and any task tagged as demo data. Task definitions survive
 * unless they were demo-only; occurrences regenerate from the recurrence
 * rules on the next page load.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const counts = {
    timeEntries: await prisma.timeEntry.count(),
    occurrences: await prisma.taskOccurrence.count(),
    summaries: await prisma.dailySummary.count(),
    timers: await prisma.activeTimer.count(),
  };

  const demoTasks = await prisma.task.findMany({
    where: { description: { contains: "[demo-day]" } },
    select: { id: true, title: true },
  });

  console.log("Clearing:");
  console.log(`  ${counts.timeEntries} time entries`);
  console.log(`  ${counts.occurrences} occurrences`);
  console.log(`  ${counts.summaries} saved summaries`);
  console.log(`  ${counts.timers} running timers`);
  console.log(`  ${demoTasks.length} demo tasks${demoTasks.length ? ": " + demoTasks.map((t) => t.title).join(", ") : ""}`);

  // Order matters: entries and timers reference occurrences.
  await prisma.timeEntry.deleteMany({});
  await prisma.activeTimer.deleteMany({});
  await prisma.dailySummary.deleteMany({});
  await prisma.taskOccurrence.deleteMany({});
  if (demoTasks.length) {
    await prisma.task.deleteMany({ where: { id: { in: demoTasks.map((t) => t.id) } } });
  }

  const users = await prisma.user.count();
  const settings = await prisma.setting.count();
  console.log(`\nKept ${users} user(s) and ${settings} setting(s). Occurrences rebuild on next load.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
