import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TaskForm } from "@/components/TaskForm";
import { Badge, PageHeader, StatBlock, StatusBadge } from "@/components/ui";
import { archiveTask, restoreTask, updateTask } from "@/actions/tasks";
import { deleteTimeEntry } from "@/actions/time";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import {
  businessToday,
  formatDuration,
  formatShortDate,
  relativeDay,
  toDateInput,
} from "@/lib/dates";
import { describeCadence } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      category: true,
      assignee: true,
      createdBy: true,
      occurrences: {
        orderBy: { dueDate: "desc" },
        take: 24,
        include: {
          timeEntries: { include: { user: true }, orderBy: { createdAt: "desc" } },
          completedBy: true,
        },
      },
    },
  });
  if (!task) notFound();

  const [categories, people] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const today = businessToday();
  const allEntries = task.occurrences.flatMap((o) => o.timeEntries);
  const totalMinutes = allEntries.reduce((sum, e) => sum + e.minutes, 0);
  const closed = task.occurrences.filter((o) => o.status === "DONE");
  const avgMinutes = closed.length
    ? Math.round(
        closed.reduce((s, o) => s + o.timeEntries.reduce((t, e) => t + e.minutes, 0), 0) /
          closed.length,
      )
    : 0;

  const updateWithId = updateTask.bind(null, task.id);
  const archived = task.archivedAt !== null;

  return (
    <AppShell user={user}>
      <PageHeader
        title={task.title}
        lede={task.description ?? undefined}
        actions={
          <>
            <Link href="/backlog" className="rc-btn rc-btn-ghost">
              Back to backlog
            </Link>
            <form
              action={async () => {
                "use server";
                if (archived) await restoreTask(task.id);
                else await archiveTask(task.id);
              }}
            >
              <button type="submit" className={`rc-btn ${archived ? "rc-btn-secondary" : "rc-btn-danger"}`}>
                {archived ? "Restore task" : "Archive task"}
              </button>
            </form>
          </>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        <Badge tone="blue">{describeCadence(task)}</Badge>
        {task.category ? <Badge tone="outline">{task.category.name}</Badge> : null}
        <Badge tone="outline">
          {task.assignee ? (task.assignee.name ?? task.assignee.email) : "Unassigned"}
        </Badge>
        {archived ? <Badge tone="danger">Archived</Badge> : null}
      </div>

      <div className="rc-card mb-10 grid grid-cols-2 gap-8 p-6 sm:grid-cols-4">
        <StatBlock value={formatDuration(totalMinutes)} label="Logged all time" />
        <StatBlock value={String(closed.length)} label="Times completed" accent="blue" />
        <StatBlock
          value={closed.length ? formatDuration(avgMinutes) : "—"}
          label="Average per cycle"
          accent="blue"
        />
        <StatBlock
          value={task.estimateMinutes ? formatDuration(task.estimateMinutes) : "—"}
          label="Estimate"
          accent="blue"
        />
      </div>

      <section className="mb-12">
        <h2 className="t-h3 mb-4 text-[var(--color-fg-1)]">History</h2>
        {task.occurrences.length === 0 ? (
          <p className="t-small text-[var(--color-fg-3)]">No occurrences yet.</p>
        ) : (
          <div className="rc-card divide-y divide-[var(--color-border-1)] overflow-hidden">
            {task.occurrences.map((o) => {
              const minutes = o.timeEntries.reduce((s, e) => s + e.minutes, 0);
              return (
                <div key={o.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="t-small font-bold text-[var(--color-fg-1)]">
                        {formatShortDate(o.dueDate, true)}
                      </span>
                      <StatusBadge status={o.status} />
                      {o.status !== "DONE" && o.status !== "SKIPPED" ? (
                        <span
                          className={`t-caption font-semibold ${
                            o.dueDate < today ? "text-[var(--color-danger)]" : ""
                          }`}
                        >
                          {relativeDay(o.dueDate, today)}
                        </span>
                      ) : null}
                    </div>
                    <span className="t-small num font-semibold text-[var(--color-fg-1)]">
                      {formatDuration(minutes)}
                    </span>
                  </div>

                  {o.timeEntries.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {o.timeEntries.map((e) => (
                        <li key={e.id} className="flex items-baseline gap-3">
                          <span className="t-caption num w-16 shrink-0 font-semibold text-[var(--color-fg-1)]">
                            {formatDuration(e.minutes)}
                          </span>
                          <span className="t-caption flex-1">
                            {e.note ?? <em>No note</em>}
                            <span className="ml-2 text-[var(--color-gray-400)]">
                              {e.user.name ?? e.user.email} · {formatShortDate(e.workDate)} ·{" "}
                              {e.source === "TIMER" ? "timer" : "manual"}
                            </span>
                          </span>
                          <form
                            action={async () => {
                              "use server";
                              await deleteTimeEntry(e.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="t-caption underline decoration-dotted hover:text-[var(--color-danger)]"
                            >
                              Remove
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="t-h3 mb-4 text-[var(--color-fg-1)]">Edit</h2>
        <p className="t-small mb-6 max-w-2xl text-[var(--color-fg-2)]">
          Changing the schedule rebuilds future occurrences. Anything already worked on or closed
          is left exactly as it is.
        </p>
        <TaskForm
          action={updateWithId}
          categories={categories}
          people={people}
          submitLabel="Save changes"
          initial={{
            title: task.title,
            description: task.description ?? "",
            categoryId: task.categoryId ?? "",
            priority: task.priority,
            cadence: task.cadence,
            interval: task.interval,
            anchorDay: task.anchorDay,
            startDate: toDateInput(task.startDate),
            endDate: task.endDate ? toDateInput(task.endDate) : "",
            estimateMinutes: task.estimateMinutes ? String(task.estimateMinutes) : "",
            assigneeId: task.assigneeId ?? "",
          }}
        />
      </section>
    </AppShell>
  );
}
