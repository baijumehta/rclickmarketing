import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { businessToday, formatLongDate } from "@/lib/dates";
import { ensureOccurrences } from "@/lib/recurrence";
import { composeDailySummary, renderForTeams } from "@/lib/summary";
import { postToTeams } from "@/lib/teams";
import { getAutoPostEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Scheduled work. Call with:
 *   Authorization: Bearer $CRON_SECRET
 *
 * Two jobs, selected with ?job=:
 *   generate      — materialise upcoming recurring occurrences (run nightly)
 *   post-summary  — post each person's end-of-day summary (run at close of business)
 *   all           — both, in that order (the default)
 *
 * On Azure this is an App Service WebJob, a Logic App recurrence, or an Azure
 * Function timer hitting this URL. Nothing here depends on a signed-in user.
 */
function authorise(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function runPostSummary() {
  if (!(await getAutoPostEnabled())) {
    return { skipped: "Automatic posting is turned off in Settings." };
  }

  const day = businessToday();

  // Anyone who logged time today is someone with a day worth reporting.
  const workers = await prisma.timeEntry.findMany({
    where: { workDate: day },
    select: { userId: true },
    distinct: ["userId"],
  });

  const results: { user: string; posted: boolean; error?: string }[] = [];

  for (const { userId } of workers) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) continue;

    const existing = await prisma.dailySummary.findUnique({
      where: { userId_date: { userId, date: day } },
    });
    // Never post the same day twice.
    if (existing?.status === "POSTED") {
      results.push({ user: user.email, posted: false, error: "already posted" });
      continue;
    }

    const composed = await composeDailySummary(userId, day);
    const body = existing?.body ?? composed.body;
    const plan = existing?.tomorrowPlan ?? composed.tomorrowPlan;

    const title = `Marketing — ${user.name ?? user.email}, ${formatLongDate(day)}`;
    const result = await postToTeams(title, renderForTeams(body, plan), process.env.AUTH_URL);

    await prisma.dailySummary.upsert({
      where: { userId_date: { userId, date: day } },
      update: {
        body,
        tomorrowPlan: plan || null,
        totalMinutes: composed.totalMinutes,
        status: result.ok ? "POSTED" : "FAILED",
        postedAt: result.ok ? new Date() : null,
        postError: result.ok ? null : result.error,
      },
      create: {
        userId,
        date: day,
        body,
        tomorrowPlan: plan || null,
        totalMinutes: composed.totalMinutes,
        status: result.ok ? "POSTED" : "FAILED",
        postedAt: result.ok ? new Date() : null,
        postError: result.ok ? null : result.error,
      },
    });

    results.push({
      user: user.email,
      posted: result.ok,
      ...(result.ok ? {} : { error: result.error }),
    });
  }

  return { posted: results };
}

async function handle(request: Request) {
  if (!authorise(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const job = new URL(request.url).searchParams.get("job") ?? "all";
  const out: Record<string, unknown> = { job, at: new Date().toISOString() };

  try {
    if (job === "generate" || job === "all") {
      out.occurrencesCreated = await ensureOccurrences();
    }
    if (job === "post-summary" || job === "all") {
      out.summary = await runPostSummary();
    }
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ...out, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
