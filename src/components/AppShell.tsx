import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/auth";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import type { SessionUser } from "@/lib/guard";

function initials(user: SessionUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s.@]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "RC";
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const items: NavItem[] = [
    { href: "/", label: "Today" },
    { href: "/backlog", label: "Backlog" },
    { href: "/summary", label: "Summary" },
  ];
  if (user.role === "MANAGER") {
    items.push({ href: "/dashboard", label: "Dashboard" }, { href: "/settings", label: "Settings" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border-1)] bg-white/90 backdrop-blur shadow-[var(--shadow-xs)]">
        <div className="rc-container flex h-[72px] items-center justify-between gap-8">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Marketing Desk home">
            {/* 225x32 is the asset's true 7.045:1 ratio. Declaring the real
                ratio keeps next/image from warning and stops the lockup
                being distorted if the CSS ever changes. */}
            <Image
              src="/brand/right-click-lockup.png"
              alt="Right Click"
              width={225}
              height={32}
              priority
            />
          </Link>

          <div className="hidden md:block">
            <NavLinks items={items} />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="t-small font-semibold text-[var(--color-fg-1)] leading-tight">
                {user.name ?? user.email}
              </div>
              <div className="t-caption leading-tight">
                {user.role === "MANAGER" ? "Manager" : "Marketing"}
              </div>
            </div>
            <div
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-blue-100)] text-[13px] font-extrabold text-[var(--color-blue-600)]"
            >
              {initials(user)}
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="rc-btn rc-btn-ghost rc-btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* The link row wraps below the lockup on narrow screens. */}
        <div className="rc-container border-t border-[var(--color-border-1)] py-3 md:hidden">
          <NavLinks items={items} />
        </div>
      </header>

      <main className="rc-container py-10">{children}</main>

      <footer className="rc-container pb-10">
        <hr className="rc-divider mb-4" />
        <p className="t-caption">
          Right Click Marketing Desk. Recurring work stays on the list until someone closes it.
        </p>
      </footer>
    </div>
  );
}
