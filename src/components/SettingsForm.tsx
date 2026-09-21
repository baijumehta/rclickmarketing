"use client";

import { useActionState, useState, useTransition } from "react";
import { saveSettings, sendTestPost, type SettingsState } from "@/actions/settings";

export function SettingsForm({
  webhookConfigured,
  webhookHost,
  payloadFormat,
  formats,
  workdayHours,
  autoPost,
}: {
  webhookConfigured: boolean;
  /** Host only. The full URL carries a signature and is never sent to the browser. */
  webhookHost: string | null;
  payloadFormat: string;
  formats: Record<string, string>;
  workdayHours: number;
  autoPost: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<SettingsState | null>(null);

  return (
    <form action={formAction} className="rc-card p-6">
      <p className="t-label">Teams</p>

      {/* Read-only. The URL is a credential and lives in TEAMS_WEBHOOK_URL,
          so there is nothing to edit here — but "is it set, and where does it
          point" is the first question when a post fails. */}
      <div className="mb-6">
        <span className="rc-field-label">Webhook</span>
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-1)] bg-[var(--color-gray-50)] px-4 py-3">
          {webhookConfigured ? (
            <>
              <span className="rc-badge rc-badge-success rc-badge-sm">Configured</span>
              <code className="font-mono text-[13px] text-[var(--color-fg-2)]">
                {webhookHost}
              </code>
            </>
          ) : (
            <>
              <span className="rc-badge rc-badge-danger rc-badge-sm">Not set</span>
              <span className="t-caption">Nothing will be posted.</span>
            </>
          )}
        </div>
        <p className="rc-hint">
          Set by the <code>TEAMS_WEBHOOK_URL</code> environment variable. The full URL ends in a
          signature that acts as a password, so it is not shown or editable here — change it in
          the environment and redeploy.
        </p>
      </div>

      <div className="mb-6">
        <label className="rc-field-label" htmlFor="payloadFormat">
          Message format
        </label>
        <select
          id="payloadFormat"
          name="payloadFormat"
          defaultValue={payloadFormat}
          className="rc-select"
        >
          {Object.entries(formats).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className="rc-hint">
          Leave on detect unless the test fails. The Workflows templates want an Adaptive Card;
          a flow you built yourself with your own schema usually wants the simple one. A 400 back
          from Teams means the format is wrong, not the URL.
        </p>
      </div>

      <div className="mb-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="autoPost"
            defaultChecked={autoPost}
            className="mt-1 h-4 w-4 accent-[var(--color-blue-500)]"
          />
          <span>
            <span className="t-small font-bold text-[var(--color-fg-1)]">
              Post the summary automatically
            </span>
            <span className="rc-hint mt-1 block">
              The scheduled job posts whatever the draft says at the end of the working day. Leave
              this off to keep posting a deliberate click.
            </span>
          </span>
        </label>
      </div>

      <hr className="rc-divider my-6" />

      <p className="t-label">Working day</p>
      <div className="mb-6 max-w-[200px]">
        <label className="rc-field-label" htmlFor="workdayHours">
          Hours in a full day
        </label>
        <input
          id="workdayHours"
          name="workdayHours"
          type="number"
          min={1}
          max={24}
          step={0.5}
          defaultValue={workdayHours}
          className="rc-input"
        />
        <p className="rc-hint">Used for the daily progress bar and the dashboard target line.</p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[#fbeaea] px-4 py-3 text-[14px] text-[var(--color-danger)]"
        >
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p role="status" className="mb-6 t-small text-[var(--color-success)]">
          {state.message}
        </p>
      ) : null}

      {testResult?.error ? (
        <p role="alert" className="mb-6 t-small text-[var(--color-danger)]">
          {testResult.error}
        </p>
      ) : null}
      {testResult?.ok ? (
        <p role="status" className="mb-6 t-small text-[var(--color-success)]">
          {testResult.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="rc-btn rc-btn-primary">
          {pending ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() =>
            startTest(async () => {
              setTestResult(null);
              setTestResult(await sendTestPost());
            })
          }
          className="rc-btn rc-btn-secondary"
        >
          {testing ? "Sending…" : "Send a test message"}
        </button>
      </div>
      <p className="rc-hint">
        Save the message format first — the test posts with whatever is saved.
      </p>
    </form>
  );
}
