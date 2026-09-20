"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { businessToday, formatLongDate, parseDateInput } from "@/lib/dates";
import { composeDailySummary, renderForTeams } from "@/lib/summary";
import { postToTeams } from "@/lib/teams";

export type SummaryState = { error?: string; ok?: boolean; posted?: boolean };

/** Save edits without posting. The summary is a draft until it is sent. */
export async function saveSummary(_prev: SummaryState, formData: FormData): Promise<SummaryState> {
  const user = await requireUser();

  const dateRaw = String(formData.get("date") ?? "");
  const day = dateRaw ? parseDateInput(dateRaw) : businessToday();
  if (!day) return { error: "That date could not be read." };

  const body = String(formData.get("body") ?? "").trim();
  const tomorrowPlan = String(formData.get("tomorrowPlan") ?? "").trim();
  if (!body) return { error: "The summary is empty." };

  const composed = await composeDailySummary(user.id, day);

  await prisma.dailySummary.upsert({
    where: { userId_date: { userId: user.id, date: day } },
    update: { body, tomorrowPlan: tomorrowPlan || null, totalMinutes: composed.totalMinutes },
    create: {
      userId: user.id,
      date: day,
      body,
      tomorrowPlan: tomorrowPlan || null,
      totalMinutes: composed.totalMinutes,
    },
  });

  revalidatePath("/summary");
  return { ok: true };
}

/** Save and send to the Teams channel. */
export async function postSummary(_prev: SummaryState, formData: FormData): Promise<SummaryState> {
  const user = await requireUser();

  const dateRaw = String(formData.get("date") ?? "");
  const day = dateRaw ? parseDateInput(dateRaw) : businessToday();
  if (!day) return { error: "That date could not be read." };

  const body = String(formData.get("body") ?? "").trim();
  const tomorrowPlan = String(formData.get("tomorrowPlan") ?? "").trim();
  if (!body) return { error: "The summary is empty." };

  const composed = await composeDailySummary(user.id, day);
  const who = user.name ?? user.email;
  const title = `Marketing — ${who}, ${formatLongDate(day)}`;
  const text = renderForTeams(body, tomorrowPlan);

  const appUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  const result = await postToTeams(title, text, appUrl);

  await prisma.dailySummary.upsert({
    where: { userId_date: { userId: user.id, date: day } },
    update: {
      body,
      tomorrowPlan: tomorrowPlan || null,
      totalMinutes: composed.totalMinutes,
      status: result.ok ? "POSTED" : "FAILED",
      postedAt: result.ok ? new Date() : null,
      postError: result.ok ? null : result.error,
    },
    create: {
      userId: user.id,
      date: day,
      body,
      tomorrowPlan: tomorrowPlan || null,
      totalMinutes: composed.totalMinutes,
      status: result.ok ? "POSTED" : "FAILED",
      postedAt: result.ok ? new Date() : null,
      postError: result.ok ? null : result.error,
    },
  });

  revalidatePath("/summary");
  return result.ok ? { ok: true, posted: true } : { error: result.error };
}

/** Throw away edits and rebuild the draft from the day's logged time. */
export async function regenerateSummary(dateValue: string): Promise<void> {
  const user = await requireUser();
  const day = parseDateInput(dateValue) ?? businessToday();
  const composed = await composeDailySummary(user.id, day);

  await prisma.dailySummary.upsert({
    where: { userId_date: { userId: user.id, date: day } },
    update: {
      body: composed.body,
      tomorrowPlan: composed.tomorrowPlan || null,
      totalMinutes: composed.totalMinutes,
      status: "DRAFT",
      postError: null,
    },
    create: {
      userId: user.id,
      date: day,
      body: composed.body,
      tomorrowPlan: composed.tomorrowPlan || null,
      totalMinutes: composed.totalMinutes,
    },
  });

  revalidatePath("/summary");
}
