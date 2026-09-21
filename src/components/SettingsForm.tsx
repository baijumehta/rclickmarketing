"use client";

import { useActionState, useState, useTransition } from "react";
import { saveSettings, sendTestPost, type SettingsState } from "@/actions/settings";

export function SettingsForm({
  workdayHours,
  autoPost,
}: {
  workdayHours: number;
  autoPost: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<SettingsState | null>(null);

  return (
    <form action={formAction} className="rc-card p-6">
      <p className="t-label">Daily summary</p>

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
        Sends a short message through the Power Automate flow, to check the path still works.
      </p>
    </form>
  );
}
