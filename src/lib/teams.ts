import {
  getTeamsPayloadFormat,
  getTeamsWebhookUrl,
  type PayloadFormat,
} from "@/lib/settings";

export type TeamsPostResult = { ok: true } | { ok: false; error: string };

/**
 * Three JSON shapes reach Teams, and which one is correct depends entirely on
 * what is listening at the other end:
 *
 * - `adaptiveCard` — what the Teams "Workflows" templates expect, both the
 *   channel one and the group-chat one. This is the normal choice.
 * - `simple` — a flat `{ title, text }` body, for a Power Automate flow built
 *   by hand where you defined the schema yourself.
 * - `messageCard` — the retired Office 365 connector format.
 *
 * Note a group chat cannot have an Incoming Webhook at all; connectors only
 * attach to channels. Posting to a group chat has to go through a flow.
 */
function isLegacyConnector(url: string): boolean {
  return /outlook\.office(365)?\.com/i.test(url);
}

function resolveFormat(format: PayloadFormat, url: string): Exclude<PayloadFormat, "auto"> {
  if (format !== "auto") return format;
  return isLegacyConnector(url) ? "messageCard" : "adaptiveCard";
}

function adaptiveCardPayload(title: string, markdown: string, linkUrl?: string) {
  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      text: title,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
      color: "Accent",
    },
    { type: "TextBlock", text: markdown, wrap: true },
  ];

  const actions = linkUrl
    ? [{ type: "Action.OpenUrl", title: "Open Marketing Desk", url: linkUrl }]
    : [];

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
          actions,
        },
      },
    ],
  };
}

function messageCardPayload(title: string, markdown: string, linkUrl?: string) {
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: "0098D5",
    summary: title,
    title,
    text: markdown,
    potentialAction: linkUrl
      ? [
          {
            "@type": "OpenUri",
            name: "Open Marketing Desk",
            targets: [{ os: "default", uri: linkUrl }],
          },
        ]
      : undefined,
  };
}

/**
 * A flat body for a flow you built yourself. `text` is the whole message
 * including the title, so a flow that only maps one field still posts
 * something complete.
 */
function simplePayload(title: string, markdown: string, linkUrl?: string) {
  return {
    title,
    text: `**${title}**\n\n${markdown}`,
    body: markdown,
    link: linkUrl ?? null,
  };
}

export function buildPayload(
  format: Exclude<PayloadFormat, "auto">,
  title: string,
  markdown: string,
  linkUrl?: string,
): unknown {
  switch (format) {
    case "messageCard":
      return messageCardPayload(title, markdown, linkUrl);
    case "simple":
      return simplePayload(title, markdown, linkUrl);
    case "adaptiveCard":
    default:
      return adaptiveCardPayload(title, markdown, linkUrl);
  }
}

/** Post a card to the configured Teams channel or chat. Never throws. */
export async function postToTeams(
  title: string,
  markdown: string,
  linkUrl?: string,
): Promise<TeamsPostResult> {
  const [url, configured] = await Promise.all([
    getTeamsWebhookUrl(),
    getTeamsPayloadFormat(),
  ]);

  if (!url) {
    return { ok: false, error: "No Teams webhook is configured. Add one on the Settings page." };
  }

  const format = resolveFormat(configured, url);
  const payload = buildPayload(format, title, markdown, linkUrl);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 400);
      return {
        ok: false,
        error:
          `Teams returned ${res.status} for the ${format} format. ${text}`.trim() +
          (res.status === 400
            ? " A 400 usually means the flow expected a different shape — try another message format below."
            : ""),
      };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not reach Teams: ${message}` };
  }
}
