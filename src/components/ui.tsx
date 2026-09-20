import type { OccurrenceStatus, Priority } from "@prisma/client";

type BadgeTone = "blue" | "navy" | "amber" | "success" | "danger" | "outline";

export function Badge({
  tone = "outline",
  small,
  children,
}: {
  tone?: BadgeTone;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`rc-badge rc-badge-${tone} ${small ? "rc-badge-sm" : ""}`}>{children}</span>
  );
}

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  URGENT: "danger",
  HIGH: "amber",
  MEDIUM: "blue",
  LOW: "outline",
};

const PRIORITY_TEXT: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority]} small>
      {PRIORITY_TEXT[priority]}
    </Badge>
  );
}

const STATUS_TONE: Record<OccurrenceStatus, BadgeTone> = {
  OPEN: "outline",
  IN_PROGRESS: "blue",
  BLOCKED: "danger",
  DONE: "success",
  SKIPPED: "outline",
};

const STATUS_TEXT: Record<OccurrenceStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  SKIPPED: "Skipped",
};

export function StatusBadge({ status }: { status: OccurrenceStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} small>
      {STATUS_TEXT[status]}
    </Badge>
  );
}

/**
 * A proof number with the amber underline. The design system allows one amber
 * treatment per view, so `accent="blue"` is the variant to reach for when a
 * view already spends its amber elsewhere.
 */
export function StatBlock({
  value,
  label,
  accent = "amber",
}: {
  value: string;
  label: string;
  accent?: "amber" | "blue";
}) {
  return (
    <div>
      <div className="rc-stat-num num">{value}</div>
      <div className={`rc-stat-rule ${accent === "blue" ? "rc-stat-rule-blue" : ""}`} />
      <div className="rc-stat-label">{label}</div>
    </div>
  );
}

/** The sentence-case label that names a panel from the inside. */
export function Label({ children, tone }: { children: React.ReactNode; tone?: "brand" }) {
  return (
    <div
      className="t-label mb-3"
      style={tone === "brand" ? { color: "var(--color-blue-600)" } : undefined}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rc-card p-8 text-center">
      <p className="t-h5 mb-2 text-[var(--color-fg-1)]">{title}</p>
      {children ? <p className="t-small text-[var(--color-fg-3)]">{children}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="t-h2 text-[var(--color-fg-1)]">{title}</h1>
        {lede ? <p className="t-body mt-2 max-w-2xl text-[var(--color-fg-2)]">{lede}</p> : null}
      </div>
      {actions ? <div className="flex gap-3">{actions}</div> : null}
    </div>
  );
}
