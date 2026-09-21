"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { OccurrenceStatus, Priority } from "@prisma/client";
import { LiveTimer } from "@/components/LiveTimer";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { blockOccurrence, setOccurrenceStatus, unblockOccurrence } from "@/actions/tasks";
import { logTime, startTimer, stopTimer } from "@/actions/time";
import { parseDurationInput } from "@/lib/dates";

export type RowData = {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  status: OccurrenceStatus;
  /** Why it is blocked, or how it got unblocked. */
  notes: string | null;
  priority: Priority;
  categoryName: string | null;
  categoryColor: string | null;
  cadenceLabel: string;
  recurring: boolean;
  dueLabel: string;
  overdue: boolean;
  minutesToday: string;
  totalMinutes: string;
  estimateLabel: string | null;
  /** ISO string when this row's timer is running, else null. */
  timerStartedAt: string | null;
  workDate: string;
};

export function TaskRow({ row, dimmed = false }: { row: RowData; dimmed?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // "why" when blocking, "how" when unblocking — same box, different prompt.
  const [reasonOpen, setReasonOpen] = useState<null | "block" | "unblock">(null);
  const [reason, setReason] = useState("");

  const running = row.timerStartedAt !== null;
  const closed = row.status === "DONE" || row.status === "SKIPPED";
  const blocked = row.status === "BLOCKED";

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not save. Try again.");
      }
    });
  }

  function submitLog() {
    const minutes = parseDurationInput(duration);
    if (minutes === null || minutes <= 0) {
      setError("Enter a duration like 45, 1:30 or 1h 15m.");
      return;
    }
    const fd = new FormData();
    fd.set("occurrenceId", row.id);
    fd.set("duration", duration);
    fd.set("note", note);
    fd.set("workDate", row.workDate);

    run(async () => {
      const res = await logTime({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDuration("");
      setNote("");
      setLogOpen(false);
    });
  }

  function submitReason() {
    const mode = reasonOpen;
    if (!mode) return;
    if (mode === "block" && !reason.trim()) {
      setError("Say what it is waiting on — that is the whole point of flagging it.");
      return;
    }
    run(async () => {
      if (mode === "block") await blockOccurrence(row.id, reason);
      else await unblockOccurrence(row.id, reason);
      setReason("");
      setReasonOpen(null);
    });
  }

  return (
    <div
      className={`px-5 py-4 transition-colors ${dimmed ? "opacity-70" : ""} ${
        running ? "bg-[var(--color-blue-50)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/tasks/${row.taskId}`}
              className={`t-h5 text-[var(--color-fg-1)] hover:text-[var(--color-blue-600)] ${
                closed ? "line-through decoration-[var(--color-gray-400)]" : ""
              }`}
            >
              {row.title}
            </Link>
            <PriorityBadge priority={row.priority} />
            {closed ? <StatusBadge status={row.status} /> : null}
            {row.status === "BLOCKED" ? <StatusBadge status={row.status} /> : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span
              className={`t-caption font-semibold ${
                row.overdue ? "text-[var(--color-danger)]" : ""
              }`}
            >
              {row.dueLabel}
            </span>

            {row.categoryName ? (
              <span className="t-caption inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: row.categoryColor ?? "var(--color-gray-400)" }}
                />
                {row.categoryName}
              </span>
            ) : null}

            {row.recurring ? <span className="t-caption">↻ {row.cadenceLabel}</span> : null}

            {row.estimateLabel ? (
              <span className="t-caption">Est. {row.estimateLabel}</span>
            ) : null}

            {row.minutesToday !== "0m" ? (
              <span className="t-caption num font-semibold text-[var(--color-blue-600)]">
                {row.minutesToday} today
              </span>
            ) : null}

            {row.totalMinutes !== "0m" && row.totalMinutes !== row.minutesToday ? (
              <span className="t-caption num">{row.totalMinutes} total</span>
            ) : null}
          </div>

          {row.notes ? (
            <p
              className={`t-caption mt-2 rounded-[var(--radius-xs)] px-2 py-1 ${
                blocked
                  ? "bg-[#fbeaea] font-semibold text-[var(--color-danger)]"
                  : "bg-[var(--color-gray-50)]"
              }`}
            >
              {blocked ? `Waiting on: ${row.notes}` : row.notes}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {running ? (
            <>
              <span className="rc-badge rc-badge-blue rc-badge-sm num">
                <span aria-hidden>●</span>
                <LiveTimer startedAt={row.timerStartedAt!} />
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => stopTimer())}
                className="rc-btn rc-btn-navy rc-btn-sm"
              >
                Stop
              </button>
            </>
          ) : closed ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => startTimer(row.id))}
              className="rc-btn rc-btn-secondary rc-btn-sm"
            >
              Start
            </button>
          )}

          {!closed ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setLogOpen((v) => !v)}
                aria-expanded={logOpen}
                className="rc-btn rc-btn-ghost rc-btn-sm"
              >
                Log time
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setOccurrenceStatus(row.id, "DONE"))}
                className="rc-btn rc-btn-primary rc-btn-sm"
              >
                Done
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setOccurrenceStatus(row.id, "OPEN"))}
              className="rc-btn rc-btn-ghost rc-btn-sm"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      {logOpen ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-1)] bg-[var(--color-gray-50)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <label className="rc-field-label" htmlFor={`dur-${row.id}`}>
                How long?
              </label>
              <input
                id={`dur-${row.id}`}
                className="rc-input"
                value={duration}
                autoFocus
                placeholder="45"
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitLog();
                  }
                }}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="rc-field-label" htmlFor={`note-${row.id}`}>
                What did you do? (optional)
              </label>
              <input
                id={`note-${row.id}`}
                className="rc-input"
                value={note}
                placeholder="Pulled rankings, flagged three pages to rewrite"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitLog();
                  }
                }}
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={submitLog}
              className="rc-btn rc-btn-primary"
            >
              Add time
            </button>
            <button
              type="button"
              onClick={() => {
                setLogOpen(false);
                setError(null);
              }}
              className="rc-btn rc-btn-ghost"
            >
              Cancel
            </button>
          </div>
          <p className="rc-hint">Accepts 45, 1:30, 1h 15m or 1.5h.</p>
        </div>
      ) : null}

      {reasonOpen ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-1)] bg-[var(--color-gray-50)] p-4">
          <label className="rc-field-label" htmlFor={`reason-${row.id}`}>
            {reasonOpen === "block" ? "What is it waiting on?" : "What unblocked it?"}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={`reason-${row.id}`}
              className="rc-input min-w-[240px] flex-1"
              value={reason}
              autoFocus
              placeholder={
                reasonOpen === "block"
                  ? "Waiting on Bhadresh for GTM access"
                  : "Got the credentials, carrying on"
              }
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitReason();
                }
              }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={submitReason}
              className="rc-btn rc-btn-primary"
            >
              {reasonOpen === "block" ? "Mark blocked" : "Unblock"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReasonOpen(null);
                setReason("");
                setError(null);
              }}
              className="rc-btn rc-btn-ghost"
            >
              Cancel
            </button>
          </div>
          <p className="rc-hint">
            {reasonOpen === "block"
              ? "Shows on the board and in the end-of-day summary, so somebody can clear it."
              : "Optional. Kept on the task history."}
          </p>
        </div>
      ) : null}

      {!closed && !reasonOpen ? (
        <div className="mt-3 flex gap-4">
          {blocked ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setReason("");
                setReasonOpen("unblock");
              }}
              className="t-caption font-semibold text-[var(--color-success)] underline decoration-dotted"
            >
              Unblock
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setReason("");
                setReasonOpen("block");
              }}
              className="t-caption underline decoration-dotted hover:text-[var(--color-fg-1)]"
            >
              Blocked
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setOccurrenceStatus(row.id, "SKIPPED"))}
            className="t-caption underline decoration-dotted hover:text-[var(--color-fg-1)]"
          >
            Skip this one
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rc-hint rc-hint-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
