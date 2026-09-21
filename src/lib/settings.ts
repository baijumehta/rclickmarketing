import { prisma } from "@/lib/db";

/**
 * Settings live in the database so they can be changed on /settings without a
 * redeploy. Environment variables act as the fallback, which keeps the app
 * working on a fresh database.
 */
export const SETTING_KEYS = {
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

/**
 * The webhook lives in the environment only, deliberately — one place to look
 * when it is wrong, and the URL is a credential, so it belongs with the other
 * secrets rather than in a database row.
 *
 * The trade-off: changing it means editing the environment variable and
 * redeploying. There is no way to change it from inside the app.
 */
export function getTeamsWebhookUrl(): string | null {
  return process.env.TEAMS_WEBHOOK_URL?.trim() || null;
}

/**
 * Read from the environment, not the database, and deliberately not editable
 * in the app. It has to match how the receiving flow was built, so the only
 * thing a wrong value produces is a silent 400 at the end of the day. It was
 * a dropdown once; saving the settings form with the default selected was
 * enough to break posting.
 */
export function getTeamsPayloadFormat(): PayloadFormat {
  const raw = process.env.TEAMS_PAYLOAD_FORMAT?.trim() ?? "";
  return isPayloadFormat(raw) ? raw : "auto";
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
