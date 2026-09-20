"use client";

import { useActionState, useState } from "react";
import { Cadence, Priority } from "@prisma/client";
import type { ActionState } from "@/actions/tasks";
import { CADENCE_LABEL } from "@/lib/recurrence";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHLY_CADENCES: Cadence[] = ["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];
const WEEKLY_CADENCES: Cadence[] = ["WEEKLY", "BIWEEKLY"];

export type TaskFormValues = {
  title: string;
  description: string;
  categoryId: string;
  priority: Priority;
  cadence: Cadence;
  interval: number;
  anchorDay: number | null;
  startDate: string;
  endDate: string;
  estimateMinutes: string;
  assigneeId: string;
};

export function TaskForm({
  action,
  categories,
  people,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; name: string }[];
  people: { id: string; name: string | null; email: string }[];
  initial: TaskFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [cadence, setCadence] = useState<Cadence>(initial.cadence);

  const isWeekly = WEEKLY_CADENCES.includes(cadence);
  const isMonthly = MONTHLY_CADENCES.includes(cadence);
  const recurring = cadence !== "NONE";

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="rc-card p-6">
        <p className="t-label">What needs doing</p>

        <div className="mb-5">
          <label className="rc-field-label" htmlFor="title">
            Task name
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={initial.title}
            className="rc-input"
            placeholder="Check SEO rankings and flag pages that slipped"
          />
        </div>

        <div className="mb-5">
          <label className="rc-field-label" htmlFor="description">
            Details
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={initial.description}
            className="rc-textarea"
            placeholder="What good looks like, where the tools are, who to ask."
          />
          <p className="rc-hint">
            Worth writing for anything recurring. In three months nobody remembers the steps.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="rc-field-label" htmlFor="categoryId">
              Category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={initial.categoryId}
              className="rc-select"
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rc-field-label" htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={initial.priority}
              className="rc-select"
            >
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="rc-field-label" htmlFor="assigneeId">
              Owner
            </label>
            <select
              id="assigneeId"
              name="assigneeId"
              defaultValue={initial.assigneeId}
              className="rc-select"
            >
              <option value="">Anyone on marketing</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rc-field-label" htmlFor="estimateMinutes">
              Estimate in minutes
            </label>
            <input
              id="estimateMinutes"
              name="estimateMinutes"
              type="number"
              min={0}
              max={10000}
              step={5}
              defaultValue={initial.estimateMinutes}
              className="rc-input"
              placeholder="60"
            />
            <p className="rc-hint">Optional. Used to compare planned against actual.</p>
          </div>
        </div>
      </div>

      <div>
        <div className="rc-card mb-6 p-6">
          <p className="t-label">How often</p>

          <div className="mb-5">
            <label className="rc-field-label" htmlFor="cadence">
              Repeat
            </label>
            <select
              id="cadence"
              name="cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="rc-select"
            >
              {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABEL[c]}
                </option>
              ))}
            </select>
            <p className="rc-hint">
              {recurring
                ? "A fresh copy appears each cycle. An unfinished one stays on the board until it is closed."
                : "A single task that disappears from the board once it is done."}
            </p>
          </div>

          {isWeekly ? (
            <div className="mb-5">
              <label className="rc-field-label" htmlFor="anchorDay">
                On which day
              </label>
              <select
                id="anchorDay"
                name="anchorDay"
                defaultValue={String(initial.anchorDay ?? 1)}
                className="rc-select"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isMonthly ? (
            <div className="mb-5">
              <label className="rc-field-label" htmlFor="anchorDay">
                On which day of the month
              </label>
              <input
                id="anchorDay"
                name="anchorDay"
                type="number"
                min={1}
                max={31}
                defaultValue={String(initial.anchorDay ?? 1)}
                className="rc-input"
              />
              <p className="rc-hint">Use 31 for the last day of the month.</p>
            </div>
          ) : null}

          {recurring && cadence !== "WEEKDAILY" ? (
            <div className="mb-5">
              <label className="rc-field-label" htmlFor="interval">
                Every
              </label>
              <input
                id="interval"
                name="interval"
                type="number"
                min={1}
                max={52}
                defaultValue={initial.interval}
                className="rc-input"
              />
              <p className="rc-hint">
                1 is the normal case. 2 on a monthly task means every two months.
              </p>
            </div>
          ) : (
            <input type="hidden" name="interval" value={1} />
          )}
        </div>

        <div className="rc-card p-6">
          <p className="t-label">When</p>

          <div className="mb-5">
            <label className="rc-field-label" htmlFor="startDate">
              {recurring ? "Start from" : "Due date"}
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={initial.startDate}
              className="rc-input"
            />
          </div>

          {recurring ? (
            <div>
              <label className="rc-field-label" htmlFor="endDate">
                Stop after
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={initial.endDate}
                className="rc-input"
              />
              <p className="rc-hint">Leave blank to keep it going indefinitely.</p>
            </div>
          ) : null}
        </div>

        {state.error ? (
          <p
            role="alert"
            className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[#fbeaea] px-4 py-3 text-[14px] text-[var(--color-danger)]"
          >
            {state.error}
          </p>
        ) : null}

        {state.ok ? (
          <p
            role="status"
            className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[var(--color-success-soft)] px-4 py-3 text-[14px] text-[var(--color-success)]"
          >
            Saved.
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="rc-btn rc-btn-primary rc-btn-lg mt-6 w-full">
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
