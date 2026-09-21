/**
 * Fill today with a realistic eight-hour day so the end-of-day summary can be
 * seen with real content in it.
 *
 *   npm run demo:day          # create the day
 *   npm run demo:day -- undo  # remove everything it created
 *
 * Demo data only. Everything it adds is tagged so undo can find it again:
 * one-off tasks it creates are marked in their description, and it only ever
 * deletes time entries it wrote itself, matched on the note text.
 */
import { PrismaClient, type OccurrenceStatus } from "@prisma/client";
import { businessToday } from "../src/lib/dates";
import { ensureOccurrences } from "../src/lib/recurrence";

const prisma = new PrismaClient();
const TAG = "[demo-day]";

/** Matched against the start of a task title. */
type Entry = {
  match: string;
  minutes: number;
  note: string;
  status: OccurrenceStatus;
  /** Set when the task does not exist yet and has to be created as a one-off. */
  create?: { title: string; category: string; estimate: number };
  notes?: string;
};

const DAY: Entry[] = [
  {
    match: "Review ad spend against budget",
    minutes: 45,
    note: "Google and LinkedIn pacing checked. LinkedIn is 18% over for the month.",
    status: "DONE",
  },
  {
    match: "Review Google Business Profile",
    minutes: 30,
    note: "Replied to four reviews, two of them negative. Hours corrected for the holiday.",
    status: "DONE",
  },
  {
    match: "Schedule next week's social posts",
    minutes: 60,
    note: "Four LinkedIn posts drafted and queued. Still need the hiring one approved.",
    status: "IN_PROGRESS",
  },
  {
    match: "Fix conversion tracking on the contact form",
    minutes: 45,
    note: "Reproduced the missing events. Needs the GTM container password.",
    status: "BLOCKED",
    notes: "Waiting on Bhadresh for GTM access",
    create: { title: "Fix conversion tracking on the contact form", category: "Website", estimate: 120 },
  },
  {
    match: "Draft the Concord case study",
    minutes: 75,
    note: "Interview notes written up. First pass through the results section.",
    status: "IN_PROGRESS",
    create: { title: "Draft the Concord case study", category: "Content", estimate: 300 },
  },
];

async function undo() {
  const notes = DAY.map((d) => d.note);
  const removed = await prisma.timeEntry.deleteMany({ where: { note: { in: notes } } });
  console.log(`Removed ${removed.count} time entries.`);

  const created = await prisma.task.findMany({
    where: { description: { contains: TAG } },
    select: { id: true, title: true },
  });
  if (created.length) {
    await prisma.task.deleteMany({ where: { id: { in: created.map((t) => t.id) } } });
    console.log(`Removed ${created.length} demo tasks: ${created.map((t) => t.title).join(", ")}`);
  }

  const day = businessToday();
  await prisma.dailySummary.deleteMany({ where: { date: day } });
  console.log("Removed today's saved summary draft.");
}

async function main() {
  if ((process.argv[2] ?? "").toLowerCase() === "undo") {
    await undo();
    return;
  }

  const day = businessToday();
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No users yet — sign in once first.");

  const categories = new Map(
    (await prisma.category.findMany()).map((c) => [c.name, c.id] as const),
  );

  let total = 0;

  for (const item of DAY) {
    let task = await prisma.task.findFirst({ where: { title: { startsWith: item.match } } });

    if (!task && item.create) {
      task = await prisma.task.create({
        data: {
          title: item.create.title,
          description: `${TAG} demo data, safe to delete.`,
          categoryId: categories.get(item.create.category) ?? null,
          priority: "HIGH",
          cadence: "NONE",
          startDate: day,
          estimateMinutes: item.create.estimate,
          assigneeId: user.id,
        },
      });
      await prisma.taskOccurrence.create({ data: { taskId: task.id, dueDate: day } });
    }

    if (!task) {
      console.log(`  skipped, no task matching "${item.match}"`);
      continue;
    }

    // The soonest still-open occurrence, so working ahead lands correctly.
    const occurrence = await prisma.taskOccurrence.findFirst({
      where: { taskId: task.id, status: { notIn: ["DONE", "SKIPPED"] } },
      orderBy: { dueDate: "asc" },
    });
    if (!occurrence) {
      console.log(`  skipped "${task.title}", nothing open`);
      continue;
    }

    const already = await prisma.timeEntry.findFirst({
      where: { occurrenceId: occurrence.id, note: item.note },
    });
    if (!already) {
      await prisma.timeEntry.create({
        data: {
          occurrenceId: occurrence.id,
          userId: user.id,
          minutes: item.minutes,
          note: item.note,
          source: "MANUAL",
          workDate: day,
        },
      });
    }

    const closing = item.status === "DONE" || item.status === "SKIPPED";
    await prisma.taskOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: item.status,
        notes: item.notes ?? occurrence.notes,
        completedAt: closing ? new Date() : null,
        completedById: closing ? user.id : null,
      },
    });

    total += item.minutes;
    console.log(`  ${String(item.minutes).padStart(3)}m  ${item.status.padEnd(12)} ${task.title}`);
  }

  await ensureOccurrences();

  const logged = await prisma.timeEntry.aggregate({
    where: { userId: user.id, workDate: day },
    _sum: { minutes: true },
  });
  const sum = logged._sum.minutes ?? 0;
  console.log(`\nAdded ${total}m. Total logged today: ${sum}m (${(sum / 60).toFixed(2)}h).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
