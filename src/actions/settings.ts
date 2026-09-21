"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/guard";
import { SETTING_KEYS, setSetting } from "@/lib/settings";
import { postToTeams } from "@/lib/teams";
import type { Role } from "@prisma/client";

export type SettingsState = { error?: string; ok?: boolean; message?: string };

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireManager();

  const hours = Number(formData.get("workdayHours"));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return { error: "Set the working day to a number of hours between 1 and 24." };
  }

  const autoPost = formData.get("autoPost") === "on";


  await Promise.all([
    setSetting(SETTING_KEYS.workdayMinutes, String(Math.round(hours * 60))),
    setSetting(SETTING_KEYS.autoPostEnabled, String(autoPost)),
  ]);

  revalidatePath("/settings");
  return { ok: true, message: "Settings saved." };
}

/** Prove the webhook works before relying on it at 5pm. */
export async function sendTestPost(): Promise<SettingsState> {
  await requireManager();
  const result = await postToTeams(
    "Marketing Desk — test message",
    "If you can read this, the Marketing Desk can post the end-of-day summary to this channel.",
    process.env.AUTH_URL,
  );
  return result.ok ? { ok: true, message: "Test message sent." } : { error: result.error };
}

export async function createCategory(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireManager();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#0098d5").trim();
  if (!name) return { error: "Give the category a name." };

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) return { error: `"${name}" already exists.` };

  await prisma.category.create({ data: { name, color } });
  revalidatePath("/settings");
  revalidatePath("/tasks/new");
  return { ok: true, message: `Added ${name}.` };
}

export async function deleteCategory(id: string): Promise<void> {
  await requireManager();
  // Tasks keep working; the relation is SetNull, so they fall back to
  // "Uncategorised" rather than disappearing.
  await prisma.category.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  const manager = await requireManager();
  // Removing your own manager access would lock the settings page.
  if (userId === manager.id && role !== "MANAGER") return;
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/settings");
}
