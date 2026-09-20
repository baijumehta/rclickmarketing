import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, PageHeader, PriorityBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { businessToday, formatDuration, relativeDay } from "@/lib/dates";
import { PRIORITY_RANK } from "@/lib/queries";
import { describeCadence } from "@/lib/recurrence";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backlog" };

type Search = { view?: string; category?: string; q?: string };

const VIEWS = [
  { key: "active", label: "Active" },
  { key: "recurring", label: "Recurring" },
  { key: "oneoff", label: "One-off" },
  { key: "archived", label: "Archived" },
];

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const { view = "active", category = "", q = "" } = await searchParams;
  const today = businessToday();

  const where: Prisma.TaskWhereInput = {
    archivedAt: view === "archived" ? { not: null } : null,
    ...(view === "recurring" ? { cadence: { not: "NONE" } } : {}),
    ...(view === "oneoff" ? { cadence: "NONE" } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const [tasks, categories] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        category: true,
        assignee: true,
        occurrences: {
          where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
        _count: { select: { occurrences: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Total logged per task, in one round trip rather than per row.
  const totals = await prisma.timeEntry.groupBy({
    by: ["occurrenceId"],
    _sum: { minutes: true },
  });
  const occurrenceTotals = new Map(totals.map((t) => [t.occurrenceId, t._sum.minutes ?? 0]));
  const taskOccurrences = await prisma.taskOccurrence.findMany({
    where: { taskId: { in: tasks.map((t) => t.id) } },
    select: { id: true, taskId: true },
  });
  const minutesByTask = new Map<string, number>();
  for (const o of taskOccurrences) {
    const mins = occurrenceTotals.get(o.id) ?? 0;
    if (mins) minutesByTask.set(o.taskId, (minutesByTask.get(o.taskId) ?? 0) + mins);
  }

  const sorted = [...tasks].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const aDue = a.occurrences[0]?.dueDate.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.occurrences[0]?.dueDate.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

  return (
    <AppShell user={user}>
      <PageHeader
        title="Backlog"
        lede="Everything on the books, one-off and recurring. Priority here decides what surfaces first on the daily board."
        actions={
          <Link href="/tasks/new" className="rc-btn rc-btn-primary">
            Add a task
          </Link>
        }
      />

      <form className="rc-card mb-8 flex flex-wrap items-end gap-4 p-5" method="get">
        <div className="min-w-[220px] flex-1">
          <label className="rc-field-label" htmlFor="q">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} className="rc-input" placeholder="Task name" />
        </div>
        <div className="w-48">
          <label className="rc-field-label" htmlFor="view">
            Show
          </label>
          <select id="view" name="view" defaultValue={view} className="rc-select">
            {VIEWS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-52">
          <label className="rc-field-label" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" defaultValue={category} className="rc-select">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rc-btn rc-btn-secondary">
          Apply
        </button>
      </form>

      {sorted.length === 0 ? (
        <EmptyState title="Nothing here yet">
          {view === "archived"
            ? "No archived tasks."
            : "Add the recurring marketing work first — the monthly SEO check, the weekly spend review — then the one-offs as they come up."}
        </EmptyState>
      ) : (
        <div className="rc-card divide-y divide-[var(--color-border-1)] overflow-hidden">
          {sorted.map((task) => {
            const next = task.occurrences[0];
            const overdue = next ? next.dueDate < today : false;
            const logged = minutesByTask.get(task.id) ?? 0;

            return (
              <div key={task.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="t-h5 text-[var(--color-fg-1)] hover:text-[var(--color-blue-600)]"
                    >
                      {task.title}
                    </Link>
                    <PriorityBadge priority={task.priority} />
                    {task.cadence !== "NONE" ? (
                      <Badge tone="blue" small>
                        ↻ {describeCadence(task)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {next ? (
                      <span
                        className={`t-caption font-semibold ${
                          overdue ? "text-[var(--color-danger)]" : ""
                        }`}
                      >
                        Next {relativeDay(next.dueDate, today).toLowerCase()}
                      </span>
                    ) : (
                      <span className="t-caption">Nothing scheduled</span>
                    )}
                    {task.category ? (
                      <span className="t-caption inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: task.category.color }}
                        />
                        {task.category.name}
                      </span>
                    ) : null}
                    <span className="t-caption">
                      {task.assignee ? (task.assignee.name ?? task.assignee.email) : "Unassigned"}
                    </span>
                    {logged > 0 ? (
                      <span className="t-caption num">{formatDuration(logged)} logged</span>
                    ) : null}
                  </div>
                </div>
                <Link href={`/tasks/${task.id}`} className="rc-btn rc-btn-ghost rc-btn-sm">
                  Open
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
