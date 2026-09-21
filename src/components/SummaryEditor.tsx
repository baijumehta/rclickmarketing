"use client";

import { useActionState, useState, useTransition } from "react";
import { postSummary, regenerateSummary, saveSummary, type SummaryState } from "@/actions/summary";

export function SummaryEditor({
  date,
  initialBody,
  initialPlan,
  posted,
  postedAtLabel,
  postError,
  webhookConfigured,
}: {
  date: string;
  initialBody: string;
  initialPlan: string;
  posted: boolean;
  postedAtLabel: string | null;
  postError: string | null;
  webhookConfigured: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState<SummaryState, FormData>(saveSummary, {});
  const [postState, postAction, posting] = useActionState<SummaryState, FormData>(postSummary, {});
  const [regenerating, startRegen] = useTransition();

  const [body, setBody] = useState(initialBody);
  const [plan, setPlan] = useState(initialPlan);

  const error = saveState.error ?? postState.error;
  const alreadyPosted = posted || postState.posted;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <form className="rc-card p-6">
        <input type="hidden" name="date" value={date} />

        <div className="mb-6">
          <label className="rc-field-label" htmlFor="body">
            What happened today
          </label>
          <textarea
            id="body"
            name="body"
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rc-textarea font-mono text-[13px] leading-relaxed"
          />
          <p className="rc-hint">
            Generated from the time logged today. Edit freely — what you see here is what gets
            posted.
          </p>
        </div>

        <div>
          <label className="rc-field-label" htmlFor="tomorrowPlan">
            Planned for tomorrow
          </label>
          <textarea
            id="tomorrowPlan"
            name="tomorrowPlan"
            rows={7}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="rc-textarea font-mono text-[13px] leading-relaxed"
          />
          <p className="rc-hint">Pre-filled with overdue work and whatever is due tomorrow.</p>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[#fbeaea] px-4 py-3 text-[14px] text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}

        {saveState.ok && !saveState.error ? (
          <p role="status" className="mt-6 t-small text-[var(--color-success)]">
            Draft saved.
          </p>
        ) : null}

        {postState.posted ? (
          <p role="status" className="mt-6 t-small text-[var(--color-success)]">
            Posted to Teams.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            formAction={postAction}
            disabled={posting || saving || !webhookConfigured}
            className="rc-btn rc-btn-primary"
          >
            {posting ? "Posting…" : alreadyPosted ? "Post again" : "Post to Teams"}
          </button>
          <button
            type="submit"
            formAction={saveAction}
            disabled={saving || posting}
            className="rc-btn rc-btn-secondary"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={regenerating}
            onClick={() =>
              startRegen(async () => {
                await regenerateSummary(date);
                // The server action revalidates; reload picks up the fresh draft.
                window.location.reload();
              })
            }
            className="rc-btn rc-btn-ghost"
          >
            {regenerating ? "Rebuilding…" : "Rebuild from logged time"}
          </button>
        </div>

        {!webhookConfigured ? (
          <p className="rc-hint rc-hint-error mt-3">
            No Teams webhook is configured. Set TEAMS_WEBHOOK_URL in the environment and redeploy.
          </p>
        ) : null}
      </form>

      <div>
        <div className="rc-panel p-6">
          <p className="t-label">Preview</p>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-blue-200)] bg-white p-4">
            <p className="t-caption mb-3">This is roughly how it lands in the channel.</p>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--color-fg-2)]">
              {body}
              {plan.trim() ? `\n\n**Tomorrow**\n${plan}` : ""}
            </div>
          </div>
        </div>

        {alreadyPosted && postedAtLabel ? (
          <p className="t-caption mt-4">Last posted {postedAtLabel}.</p>
        ) : null}

        {postError ? (
          <p className="t-caption mt-4 text-[var(--color-danger)]">
            Last attempt failed: {postError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
