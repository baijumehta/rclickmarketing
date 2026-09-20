import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TaskRow } from "@/components/TaskRow";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { businessToday, formatDuration, formatLongDate } from "@/lib/dates";
import { getDayBoard, getRunningTimer } from "@/lib/queries";
import { ensureOccurrences } from "@/lib/recurrence";
import { getWorkdayMinutes } from "@/lib/settings";
import { toRow } from "@/lib/rows";

export const dynamic = "force-dynamic";

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "danger";
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-8">
      <h2
        className="t-h5 mb-3 flex items-center gap-2"
        style={{ color: tone === "danger" ? "var(--color-danger)" : "var(--color-fg-1)" }}
      >
        {title}
        <span className="t-caption num font-semibold">{count}</span>
      </h2>
      <div className="rc-card divide-y divide-[var(--color-border-1)] overflow-hidden">
        {children}
      </div>
    </section>
  );
}

export default async function TodayPage() {
  const user = await requireUser();

  // Cheap and idempotent: guarantees the recurring work for the next two weeks
  // exists before the board is read, without waiting on the nightly job.
  await ensureOccurrences();

  const day = businessToday();
  const [board, timer, workdayMinutes] = await Promise.all([
    getDayBoard(user.id, day),
    getRunningTimer(user.id),
    getWorkdayMinutes(),
  ]);

  const runningId = timer?.occurrenceId ?? null;
  const runningStart = timer?.startedAt ?? null;
  const row = (o: Parameters<typeof toRow>[0]) => toRow(o, day, runningId, runningStart);

  const pct = Math.min(100, Math.round((board.minutesLogged / workdayMinutes) * 100));
  const remaining = Math.max(0, workdayMinutes - board.minutesLogged);
  const openCount = board.overdue.length + board.today.length;

  return (
    <AppShell user={user}>
      {/* The day header. The one navy canvas on this view. */}
      <div className="rc-navy rc-rise mb-10 rounded-[var(--radius-xl)] p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="t-label" style={{ color: "var(--color-blue-300)" }}>
              {formatLongDate(day)}
            </p>
            <h1 className="t-h2 mt-1 text-white">
              {openCount === 0
                ? "Nothing open. Good."
                : `${openCount} ${openCount === 1 ? "thing" : "things"} to work`}
            </h1>
            <p className="t-body mt-2 max-w-xl" style={{ color: "var(--color-blue-300)" }}>
              {board.overdue.length > 0
                ? `${board.overdue.length} ${
                    board.overdue.length === 1 ? "item is" : "items are"
                  } past due and still waiting.`
                : "Everything on the board is on schedule."}
            </p>
          </div>

          <div className="min-w-[260px]">
            <div className="flex items-baseline justify-between gap-4">
              <span className="num text-[30px] font-extrabold leading-none text-white">
                {formatDuration(board.minutesLogged)}
              </span>
              <span className="t-caption" style={{ color: "var(--color-blue-300)" }}>
                of {formatDuration(workdayMinutes)}
              </span>
            </div>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Day logged against target"
            >
              <div
                className="h-full rounded-full bg-[var(--color-blue-500)] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="t-caption mt-2" style={{ color: "var(--color-blue-300)" }}>
              {remaining === 0
                ? "Day accounted for."
                : `${formatDuration(remaining)} still unaccounted for.`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/tasks/new" className="rc-btn rc-btn-ondark">
            Add a task
          </Link>
          <Link href="/summary" className="rc-btn rc-btn-primary">
            Write the end-of-day summary
          </Link>
        </div>
      </div>

      <Section title="Overdue" count={board.overdue.length} tone="danger">
        {board.overdue.map((o) => (
          <TaskRow key={o.id} row={row(o)} />
        ))}
      </Section>

      <Section title="Due today" count={board.today.length}>
        {board.today.map((o) => (
          <TaskRow key={o.id} row={row(o)} />
        ))}
      </Section>

      {openCount === 0 && board.done.length === 0 ? (
        <EmptyState title="Nothing on the board today">
          Add a one-off task, or set up the recurring work so it shows up by itself.
        </EmptyState>
      ) : null}

      <Section title="Closed today" count={board.done.length}>
        {board.done.map((o) => (
          <TaskRow key={o.id} row={row(o)} dimmed />
        ))}
      </Section>

      {board.upcoming.length > 0 ? (
        <section className="mt-10">
          <h2 className="t-h5 mb-3 text-[var(--color-fg-1)]">Coming up</h2>
          <div className="rc-panel divide-y divide-[var(--color-blue-200)] overflow-hidden">
            {board.upcoming.slice(0, 12).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <Link
                  href={`/tasks/${o.taskId}`}
                  className="t-small font-semibold text-[var(--color-fg-1)] hover:text-[var(--color-blue-600)]"
                >
                  {o.task.title}
                </Link>
                <span className="t-caption shrink-0">{row(o).dueLabel}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
