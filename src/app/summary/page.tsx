import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SummaryEditor } from "@/components/SummaryEditor";
import { PageHeader, StatBlock } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import {
  addDays,
  businessToday,
  formatDuration,
  formatLongDate,
  parseDateInput,
  toDateInput,
} from "@/lib/dates";
import { getDayBoard } from "@/lib/queries";
import { composeDailySummary } from "@/lib/summary";
import { getTeamsWebhookUrl, getWorkdayMinutes } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "End of day" };

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { date } = await searchParams;
  const day = (date ? parseDateInput(date) : null) ?? businessToday();

  const [saved, composed, board, workdayMinutes, webhook] = await Promise.all([
    prisma.dailySummary.findUnique({
      where: { userId_date: { userId: user.id, date: day } },
    }),
    composeDailySummary(user.id, day),
    getDayBoard(user.id, day),
    getWorkdayMinutes(),
    getTeamsWebhookUrl(),
  ]);

  const doneCount = board.done.filter((o) => o.status === "DONE").length;
  const openCount = board.overdue.length + board.today.length;
  const shortfall = Math.max(0, workdayMinutes - board.minutesLogged);

  const prev = toDateInput(addDays(day, -1));
  const next = toDateInput(addDays(day, 1));
  const isToday = day.getTime() === businessToday().getTime();

  return (
    <AppShell user={user}>
      <PageHeader
        title="End of day"
        lede="The daily Teams update, built from what was actually logged. Edit anything that needs saying in your own words, then post it."
        actions={
          <>
            <Link href={`/summary?date=${prev}`} className="rc-btn rc-btn-ghost">
              ← Previous day
            </Link>
            {!isToday ? (
              <Link href={`/summary?date=${next}`} className="rc-btn rc-btn-ghost">
                Next day →
              </Link>
            ) : null}
          </>
        }
      />

      <p className="t-label mb-6">{formatLongDate(day)}</p>

      <div className="rc-card mb-10 grid grid-cols-2 gap-8 p-6 sm:grid-cols-4">
        <StatBlock value={formatDuration(board.minutesLogged)} label="Logged today" />
        <StatBlock value={String(doneCount)} label="Tasks closed" accent="blue" />
        <StatBlock value={String(openCount)} label="Still open" accent="blue" />
        <StatBlock
          value={shortfall === 0 ? "Accounted" : formatDuration(shortfall)}
          label={shortfall === 0 ? "Full day covered" : "Unaccounted for"}
          accent="blue"
        />
      </div>

      <SummaryEditor
        date={toDateInput(day)}
        initialBody={saved?.body ?? composed.body}
        initialPlan={saved?.tomorrowPlan ?? composed.tomorrowPlan}
        posted={saved?.status === "POSTED"}
        postedAtLabel={
          saved?.postedAt
            ? saved.postedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
            : null
        }
        postError={saved?.status === "FAILED" ? saved.postError : null}
        webhookConfigured={Boolean(webhook)}
      />
    </AppShell>
  );
}
