import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CategoryBars, DailyHoursChart } from "@/components/Charts";
import { Badge, EmptyState, PageHeader, StatBlock } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/guard";
import {
  addDays,
  businessToday,
  formatDuration,
  formatShortDate,
  isWeekend,
  relativeDay,
} from "@/lib/dates";
import { getCategoryTotals, getDailyTotals, getSlippingRecurring } from "@/lib/queries";
import { getWorkdayMinutes } from "@/lib/settings";
import { describeCadence } from "@/lib/recurrence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const RANGES = [
  { key: "14", label: "Last 14 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; person?: string }>;
}) {
  const user = await requireManager();
  const { days: daysRaw = "14", person = "" } = await searchParams;

  const windowDays = Math.min(180, Math.max(7, Number(daysRaw) || 14));
  const today = businessToday();
  const from = addDays(today, -(windowDays - 1));

  const [dailyTotals, categoryTotals, slipping, workdayMinutes, people] = await Promise.all([
    getDailyTotals(from, today, person || undefined),
    getCategoryTotals(from, today, person || undefined),
    getSlippingRecurring(today),
    getWorkdayMinutes(),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const weekdays = dailyTotals.filter((d) => !isWeekend(d.date));
  const totalMinutes = dailyTotals.reduce((s, d) => s + d.minutes, 0);
  const avgWeekday = weekdays.length
    ? Math.round(weekdays.reduce((s, d) => s + d.minutes, 0) / weekdays.length)
    : 0;
  const coverage = workdayMinutes > 0 ? Math.round((avgWeekday / workdayMinutes) * 100) : 0;
  const daysUnder = weekdays.filter((d) => d.minutes < workdayMinutes * 0.75).length;

  return (
    <AppShell user={user}>
      <PageHeader
        title="Dashboard"
        lede="Where the time actually went, and what recurring work has quietly slipped."
      />

      <form className="rc-card mb-10 flex flex-wrap items-end gap-4 p-5" method="get">
        <div className="w-52">
          <label className="rc-field-label" htmlFor="days">
            Period
          </label>
          <select id="days" name="days" defaultValue={String(windowDays)} className="rc-select">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-60">
          <label className="rc-field-label" htmlFor="person">
            Person
          </label>
          <select id="person" name="person" defaultValue={person} className="rc-select">
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.email}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rc-btn rc-btn-secondary">
          Apply
        </button>
      </form>

      <div className="rc-card mb-10 grid grid-cols-2 gap-8 p-6 sm:grid-cols-4">
        <StatBlock value={formatDuration(avgWeekday)} label="Average weekday" />
        <StatBlock value={`${coverage}%`} label="Of the target day" accent="blue" />
        <StatBlock value={formatDuration(totalMinutes)} label="Logged in period" accent="blue" />
        <StatBlock
          value={String(daysUnder)}
          label="Weekdays under 75% logged"
          accent="blue"
        />
      </div>

      <section className="mb-12">
        <h2 className="t-h3 mb-1 text-[var(--color-fg-1)]">Hours logged per day</h2>
        <p className="t-small mb-6 max-w-2xl text-[var(--color-fg-2)]">
          A short bar is not automatically a short day — it can mean the time was never logged.
          Both are worth knowing.
        </p>
        <div className="rc-card p-6">
          <DailyHoursChart days={dailyTotals} targetMinutes={workdayMinutes} />
        </div>
      </section>

      <div className="mb-12 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="t-h3 mb-1 text-[var(--color-fg-1)]">Where the hours went</h2>
          <p className="t-small mb-6 text-[var(--color-fg-2)]">By category, over the period.</p>
          <div className="rc-card p-6">
            {categoryTotals.length === 0 ? (
              <p className="t-small text-[var(--color-fg-3)]">No time logged in this period.</p>
            ) : (
              <CategoryBars rows={categoryTotals} />
            )}
          </div>
        </section>

        <section>
          <h2 className="t-h3 mb-1 text-[var(--color-fg-1)]">Recurring work that slipped</h2>
          <p className="t-small mb-6 text-[var(--color-fg-2)]">
            Repeating tasks past their due date and still open. This is the list that used to live
            in nobody&rsquo;s head.
          </p>
          {slipping.length === 0 ? (
            <div className="rc-panel p-6">
              <p className="t-small font-semibold text-[var(--color-fg-1)]">
                Nothing overdue. Every recurring task is on schedule.
              </p>
            </div>
          ) : (
            <div className="rc-card divide-y divide-[var(--color-border-1)] overflow-hidden">
              {slipping.slice(0, 12).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tasks/${o.taskId}`}
                      className="t-small font-bold text-[var(--color-fg-1)] hover:text-[var(--color-blue-600)]"
                    >
                      {o.task.title}
                    </Link>
                    <div className="t-caption mt-0.5">
                      {describeCadence(o.task)} · due {formatShortDate(o.dueDate)}
                      {o.task.assignee ? ` · ${o.task.assignee.name ?? o.task.assignee.email}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0">
                    <Badge tone="danger" small>
                      {relativeDay(o.dueDate, today)}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {dailyTotals.every((d) => d.minutes === 0) ? (
        <EmptyState title="No time logged yet">
          Once tasks start getting worked and timed, this page fills in.
        </EmptyState>
      ) : null}
    </AppShell>
  );
}
