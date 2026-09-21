"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  allowAddAnother = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; name: string }[];
  people: { id: string; name: string | null; email: string }[];
  initial: TaskFormValues;
  submitLabel: string;
  /** Adds a second submit that keeps the form open for the next task. */
  allowAddAnother?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [cadence, setCadence] = useState<Cadence>(initial.cadence);

  // React resets the form after a successful action, which returns every
  // uncontrolled field to its defaultValue. The fields meant to carry over to
  // the next task therefore have to be controlled.
  const [sticky, setSticky] = useState({
    categoryId: initial.categoryId,
    priority: String(initial.priority),
    assigneeId: initial.assigneeId,
    interval: String(initial.interval),
    anchorDay: String(initial.anchorDay ?? 1),
    startDate: initial.startDate,
    endDate: initial.endDate,
  });
  const bind = (key: keyof typeof sticky) => ({
    value: sticky[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setSticky((s) => ({ ...s, [key]: e.target.value })),
  });

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const estimateRef = useRef<HTMLInputElement>(null);

  // Everything added without leaving the page, so a batch shows its own trail.
  const [added, setAdded] = useState<{ id: string; title: string }[]>([]);
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    if (!state.createdId || state.createdId === lastHandled.current) return;
    lastHandled.current = state.createdId;

    setAdded((prev) => [{ id: state.createdId!, title: state.createdTitle ?? "Task" }, ...prev]);

    // Clear only what changes per task. Category, priority, owner, cadence and
    // dates stay, because a batch is usually variations on one theme and
    // retyping them is the slow part.
    if (titleRef.current) titleRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (estimateRef.current) estimateRef.current.value = "";
    titleRef.current?.focus();
  }, [state.createdId, state.createdTitle]);

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
            ref={titleRef}
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
            ref={descriptionRef}
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
              {...bind("categoryId")}
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
              {...bind("priority")}
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
              {...bind("assigneeId")}
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
              ref={estimateRef}
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
                {...bind("anchorDay")}
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
                {...bind("anchorDay")}
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
                {...bind("interval")}
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
              {...bind("startDate")}
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
                {...bind("endDate")}
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

        {state.ok && !state.createdId ? (
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

        {allowAddAnother ? (
          <>
            {/* The button's own name and value go into the form data, so the
                action knows which of the two was pressed. */}
            <button
              type="submit"
              name="andAnother"
              value="1"
              disabled={pending}
              className="rc-btn rc-btn-secondary rc-btn-lg mt-3 w-full"
            >
              {pending ? "Saving…" : "Save and add another"}
            </button>
            <p className="rc-hint">
              Keeps the category, priority, owner, repeat and dates, clears the rest, and puts
              the cursor back in the task name.
            </p>
          </>
        ) : null}

        {added.length > 0 ? (
          <div
            role="status"
            className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[var(--color-success-soft)] p-4"
          >
            <p className="t-small font-bold text-[var(--color-success)]">
              Added {added.length} {added.length === 1 ? "task" : "tasks"}
            </p>
            <ul className="mt-2 space-y-1">
              {added.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="t-caption underline decoration-dotted hover:text-[var(--color-fg-1)]"
                  >
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
            {added.length > 6 ? (
              <p className="t-caption mt-1">and {added.length - 6} more</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
