import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

/** Emails that get MANAGER on first sign-in. Everyone else in the tenant is MARKETING. */
function managerEmails(): string[] {
  return (process.env.MANAGER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Local sign-in without an Entra app registration. Only ever enabled outside
 * production and only when DEV_LOGIN=true, so it cannot be turned on by
 * accident on the Azure App Service.
 */
const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";

const providers = [
  MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    authorization: { params: { scope: "openid profile email offline_access User.Read" } },
  }),
];

if (devLoginEnabled) {
  providers.push(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Credentials({
      id: "dev",
      name: "Developer sign-in",
      credentials: { email: { label: "Email" } },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email) return null;
        const role: Role = managerEmails().includes(email) ? "MANAGER" : "MARKETING";
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0], role },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions so the dev credentials provider works and so role lookups do
  // not hit the database on every request.
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      // Optional hard tenant lock. Without it, any Entra account that the app
      // registration accepts could sign in.
      const allowed = process.env.ALLOWED_TENANT_ID?.trim();
      if (allowed) {
        const tid = (profile as { tid?: string } | undefined)?.tid;
        if (tid !== allowed) return false;
      }
      return true;
    },

    async jwt({ token, user }) {
      // On first sign-in `user` is present. After that we only re-read the role
      // when it is missing from the token, so a role change needs a re-login.
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (!email) return token;

      if (!token.uid || !token.role) {
        const desiredRole: Role = managerEmails().includes(email) ? "MANAGER" : "MARKETING";
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: user?.name ?? email.split("@")[0], role: desiredRole },
        });
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.name = dbUser.name;
        token.picture = dbUser.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.role) session.user.role = token.role as Role;
      return session;
    },
  },
});

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
