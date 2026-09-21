import { prisma } from "@/lib/db";

/**
 * Settings live in the database so they can be changed on /settings without a
 * redeploy. Environment variables act as the fallback, which keeps the app
 * working on a fresh database.
 */
export const SETTING_KEYS = {
  teamsWebhookUrl: "teams.webhookUrl",
  teamsPayloadFormat: "teams.payloadFormat",
  workdayMinutes: "workday.minutes",
  autoPostEnabled: "summary.autoPost",
} as const;

/**
 * What JSON to POST at the webhook. Which one is right depends on how the
 * receiving end was built, and there is no way to detect it reliably, so it
 * is a choice rather than a guess.
 */
export const PAYLOAD_FORMATS = {
  auto: "Detect from the URL",
  adaptiveCard: "Adaptive Card (Teams Workflows templates)",
  simple: "Simple JSON: title and text (hand-built flows)",
  messageCard: "MessageCard (retired Office 365 connectors)",
} as const;

export type PayloadFormat = keyof typeof PAYLOAD_FORMATS;

export function isPayloadFormat(value: string): value is PayloadFormat {
  return value in PAYLOAD_FORMATS;
}

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

export async function getTeamsPayloadFormat(): Promise<PayloadFormat> {
  const stored = (await getSetting(SETTING_KEYS.teamsPayloadFormat))?.trim() ?? "";
  return isPayloadFormat(stored) ? stored : "auto";
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
