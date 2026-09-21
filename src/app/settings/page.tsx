import { AppShell } from "@/components/AppShell";
import { SettingsForm } from "@/components/SettingsForm";
import { CategoryForm } from "@/components/CategoryForm";
import { CATEGORY_PALETTE } from "@/components/Charts";
import { Badge, PageHeader } from "@/components/ui";
import { deleteCategory, setUserRole } from "@/actions/settings";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/guard";
import {
  PAYLOAD_FORMATS,
  getAutoPostEnabled,
  getTeamsPayloadFormat,
  getTeamsWebhookUrl,
  getWorkdayMinutes,
} from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireManager();

  const [webhook, payloadFormat, workdayMinutes, autoPost, categories, users] = await Promise.all([
    getTeamsWebhookUrl(),
    getTeamsPayloadFormat(),
    getWorkdayMinutes(),
    getAutoPostEnabled(),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.user.findMany({ orderBy: { email: "asc" } }),
  ]);

  const suggested = CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length];

  // Host only — the query string holds the signature that authorises posting.
  let webhookHost: string | null = null;
  if (webhook) {
    try {
      webhookHost = new URL(webhook).host;
    } catch {
      webhookHost = "unreadable URL";
    }
  }

  return (
    <AppShell user={user}>
      <PageHeader
        title="Settings"
        lede="Where the daily summary goes, what counts as a full day, and who can see what."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <SettingsForm
          webhookConfigured={Boolean(webhook)}
          webhookHost={webhookHost}
          payloadFormat={payloadFormat}
          formats={PAYLOAD_FORMATS}
          workdayHours={workdayMinutes / 60}
          autoPost={autoPost}
        />

        <div>
          <div className="rc-card mb-8 p-6">
            <p className="t-label">Categories</p>
            <p className="t-caption mb-5">
              Categories drive the dashboard breakdown. Deleting one leaves its tasks
              uncategorised rather than removing them.
            </p>

            <CategoryForm suggestedColor={suggested} />

            {categories.length === 0 ? (
              <p className="t-small text-[var(--color-fg-3)]">No categories yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-1)]">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="t-small inline-flex items-center gap-2.5 font-semibold text-[var(--color-fg-1)]">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.name}
                      <span className="t-caption font-normal">
                        {c._count.tasks} {c._count.tasks === 1 ? "task" : "tasks"}
                      </span>
                    </span>
                    <form
                      action={async () => {
                        "use server";
                        await deleteCategory(c.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="t-caption underline decoration-dotted hover:text-[var(--color-danger)]"
                      >
                        Delete
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rc-card p-6">
            <p className="t-label">People</p>
            <p className="t-caption mb-5">
              Anyone in the Right Click tenant who signs in appears here as Marketing. Managers can
              see the dashboard and change settings.
            </p>

            <ul className="divide-y divide-[var(--color-border-1)]">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="t-small font-bold text-[var(--color-fg-1)]">
                      {u.name ?? u.email}
                    </div>
                    <div className="t-caption truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={u.role === "MANAGER" ? "navy" : "outline"} small>
                      {u.role === "MANAGER" ? "Manager" : "Marketing"}
                    </Badge>
                    {u.id === user.id ? (
                      <span className="t-caption">You</span>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await setUserRole(u.id, u.role === "MANAGER" ? "MARKETING" : "MANAGER");
                        }}
                      >
                        <button type="submit" className="rc-btn rc-btn-ghost rc-btn-sm">
                          Make {u.role === "MANAGER" ? "marketing" : "manager"}
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
