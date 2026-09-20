"use client";

import { useActionState } from "react";
import { createCategory, type SettingsState } from "@/actions/settings";

export function CategoryForm({ suggestedColor }: { suggestedColor: string }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    createCategory,
    {},
  );

  return (
    <form action={formAction} className="mb-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="rc-field-label" htmlFor="name">
            New category
          </label>
          <input id="name" name="name" className="rc-input" placeholder="Paid ads" required />
        </div>
        <div>
          <label className="rc-field-label" htmlFor="color">
            Colour
          </label>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue={suggestedColor}
            className="h-[46px] w-16 cursor-pointer rounded-[var(--radius-md)] border-[1.5px] border-[var(--color-border-2)] bg-white p-1"
          />
        </div>
        <button type="submit" disabled={pending} className="rc-btn rc-btn-secondary">
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="rc-hint rc-hint-error">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rc-hint" style={{ color: "var(--color-success)" }}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
