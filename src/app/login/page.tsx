import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  AccessDenied: "That account is not in the Right Click tenant, so it cannot sign in here.",
  Configuration: "Sign-in is not configured yet. Check the Entra ID values in the environment.",
  Verification: "That sign-in link has expired. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;
  const devLogin = process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";

  return (
    <div className="rc-navy grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-[440px]">
        <Image
          src="/brand/right-click-lockup-white.png"
          alt="Right Click"
          width={180}
          height={38}
          priority
          className="mb-10 h-9 w-auto"
        />

        <div className="rc-card p-8">
          <h1 className="t-h3 text-[var(--color-fg-1)]">Marketing Desk</h1>
          <p className="t-small mt-3 text-[var(--color-fg-2)]">
            The marketing task board: recurring work that never falls off the list, time logged
            against every task, and the end-of-day summary posted to Teams.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[#fbeaea] px-4 py-3 text-[14px] text-[var(--color-danger)]"
            >
              {ERRORS[error] ?? "Sign-in did not complete. Try again."}
            </p>
          ) : null}

          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            }}
          >
            <button type="submit" className="rc-btn rc-btn-primary rc-btn-lg w-full">
              Sign in with Microsoft
            </button>
          </form>

          <p className="rc-hint mt-4">
            Uses your Right Click account. No separate password.
          </p>

          {devLogin ? (
            <>
              <hr className="rc-divider my-8" />
              <p className="t-label">Developer sign-in</p>
              <p className="t-caption mb-3">
                Local only. Disabled whenever NODE_ENV is production.
              </p>
              <form
                className="flex gap-2"
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("dev", {
                    email: String(formData.get("email") ?? ""),
                    redirectTo: "/",
                  });
                }}
              >
                <input
                  name="email"
                  type="email"
                  required
                  className="rc-input"
                  placeholder="you@rclick.com"
                  aria-label="Email for developer sign-in"
                />
                <button type="submit" className="rc-btn rc-btn-secondary">
                  Enter
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
