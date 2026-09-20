import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export type SessionUser = { id: string; email: string; name: string | null; role: Role };

/** Every page and action goes through this. No session, no app. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role: session.user.role ?? "MARKETING",
  };
}

/** Manager-only surfaces: the dashboards and anything that changes settings. */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/?denied=manager");
  return user;
}

export function isManager(user: { role: Role }): boolean {
  return user.role === "MANAGER";
}
