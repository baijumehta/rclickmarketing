import { getTeamsWebhookUrl } from "@/lib/settings";

export type TeamsPostResult = { ok: true } | { ok: false; error: string };

/**
 * Microsoft is retiring the old Office 365 connectors in favour of Workflows
 * (Power Automate) webhooks, and the two want different payloads. Old-style
 * URLs are on outlook.office.com / outlook.office365.com; Workflows URLs are
 * on *.logic.azure.com. Detect and send the right shape rather than making
 * whoever sets this up care which kind of webhook they copied.
 */
function isLegacyConnector(url: string): boolean {
  return /outlook\.office(365)?\.com/i.test(url);
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

/** Post a card to the configured Teams channel. Never throws. */
export async function postToTeams(
  title: string,
  markdown: string,
  linkUrl?: string,
): Promise<TeamsPostResult> {
  const url = await getTeamsWebhookUrl();
  if (!url) {
    return { ok: false, error: "No Teams webhook is configured. Add one on the Settings page." };
  }

  const payload = isLegacyConnector(url)
    ? messageCardPayload(title, markdown, linkUrl)
    : adaptiveCardPayload(title, markdown, linkUrl);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 400);
      return { ok: false, error: `Teams returned ${res.status}. ${text}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not reach Teams: ${message}` };
  }
}
