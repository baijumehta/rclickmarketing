import { prisma } from "@/lib/db";

/**
 * Settings live in the database so they can be changed on /settings without a
 * redeploy. Environment variables act as the fallback, which keeps the app
 * working on a fresh database.
 */
export const SETTING_KEYS = {
  teamsWebhookUrl: "teams.webhookUrl",
  workdayMinutes: "workday.minutes",
  autoPostEnabled: "summary.autoPost",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getTeamsWebhookUrl(): Promise<string | null> {
  const stored = await getSetting(SETTING_KEYS.teamsWebhookUrl);
  return stored?.trim() || process.env.TEAMS_WEBHOOK_URL?.trim() || null;
}

/** The target length of a working day, in minutes. Defaults to eight hours. */
export async function getWorkdayMinutes(): Promise<number> {
  const stored = await getSetting(SETTING_KEYS.workdayMinutes);
  const parsed = Number(stored);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 480;
}

export async function getAutoPostEnabled(): Promise<boolean> {
  return (await getSetting(SETTING_KEYS.autoPostEnabled)) === "true";
}
