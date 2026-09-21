# Right Click Marketing Desk

The marketing team's daily workspace. It exists to fix three specific problems:

1. **Recurring work falls off the list.** "Check SEO monthly", "review spend weekly" — asked
   for once, done twice, then quietly forgotten. Here a recurring task generates a fresh
   occurrence every cycle, and an unfinished one *stays on the board, marked overdue*, until
   somebody closes it. Nothing is ever silently dropped.
2. **Nobody knows where the eight hours went.** Every task takes time entries — a start/stop
   timer or a typed duration. The day shows logged-against-target as you go, and the dashboard
   shows the pattern across weeks.
3. **The daily Teams update is written by hand.** The app composes it from what was actually
   logged — what got done, how long each thing took, what is still overdue, what is planned for
   tomorrow — and posts it to the channel.

Built on Next.js 15, Prisma, Neon Postgres and Entra ID SSO, styled from the shared
**Right Click Design System** (Mulish, brand blue `#0098d5`, navy `#0d273c`).

---

## Screens

| Route | Who | What |
|---|---|---|
| `/` | Everyone | Today's board: overdue, due today, closed today, coming up. Timer and worklog on each row. Progress against the target day. |
| `/backlog` | Everyone | Every task, one-off and recurring. Search and filter, set priority. |
| `/tasks/new`, `/tasks/[id]` | Everyone | Create and edit tasks, set the recurrence rule, see full history and every time entry. |
| `/summary` | Everyone | The end-of-day message, pre-written from logged time. Edit, then post to Teams. |
| `/dashboard` | Manager | Hours per day against target, where the hours went by category, and recurring work that has slipped. |
| `/settings` | Manager | Teams webhook, length of the working day, categories, who is a manager. |

---

## Local setup

```bash
npm install
```

Secrets go in **`.env.local`** (gitignored). `.env.example` is the annotated template — copy it
if the file is missing. Fill in the Neon and Entra values, then:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

> **Why the `db:*` scripts wrap `dotenv`:** Next.js reads `.env.local` natively, but the Prisma
> CLI does not — it only looks at `.env`. Without the wrapper, `prisma migrate` reports a
> missing `DATABASE_URL` while the app itself works fine. Run Prisma through `npm run db:*`
> rather than calling `npx prisma` directly, or it will not see your connection string.

Set `DEV_LOGIN="true"` to sign in with just an email address and skip Entra while developing.
It is ignored whenever `NODE_ENV` is production, so it cannot leak to the deployment.

`npm run db:seed` loads seven categories and eight recurring marketing tasks as a starting
point — the monthly SEO check, the weekly spend review, the monthly report, and so on.

### Checking the scheduling logic

```bash
npm run check
```

50 assertions over the recurrence engine and the date/duration helpers — month-end clamping
(31 Jan monthly lands on 28 Feb, and recovers to 31 Mar), leap years, weekday-only cadences,
quarterly seeding, and the duration parser. No database needed.

---

## Deploying

### 1. Neon

Create a project. You need **two** connection strings from the dashboard:

- `DATABASE_URL` — the **pooled** string (host contains `-pooler`). The app uses it.
- `DIRECT_URL` — the **direct** string. Prisma migrations use it, because they need a real
  session that the pooler cannot provide.

Then run the migration against it once: `npx prisma migrate deploy`.

### 2. Entra ID app registration

Azure portal → **App registrations** → New registration.

- Supported account types: **single tenant**.
- Redirect URI (Web): `https://YOUR-DOMAIN/api/auth/callback/microsoft-entra-id`
  (add `http://localhost:3000/api/auth/callback/microsoft-entra-id` too, for local work).
- **Certificates & secrets** → new client secret → copy the *value*.
- Copy the Application (client) ID and the Directory (tenant) ID.

Fill in `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`,
`AUTH_MICROSOFT_ENTRA_ID_ISSUER` and `ALLOWED_TENANT_ID`.

Anyone in the tenant who signs in gets the **Marketing** role. Emails listed in
`MANAGER_EMAILS` get **Manager** on first sign-in; after that, roles are managed on
`/settings`.

### 3. Vercel

Import the repo, then set **every** variable from `.env.example` as a project environment
variable. `AUTH_URL` must be the real deployment URL, not localhost.

Filling in `.env.local` configures your machine only — that file is gitignored and never
reaches Vercel. Missing variables show up as a 500 from `/api/auth/csrf` and a
"Sign-in is not configured yet" message on the login page.

Three ways to set them, fastest first:

1. **Paste a .env file.** Vercel's Environment Variables screen accepts pasted `.env`
   content — paste the whole file at once instead of filling in 13 separate rows.
2. **PowerShell:** `.\scripts\push-vercel-env.ps1` (add `-WhatIfOnly` to preview, or
   `-Target preview` for the preview environment).
3. **bash / macOS / CI:** `bash scripts/push-vercel-env.sh`.

Both scripts read `.env.vercel.local` and need `npm i -g vercel && vercel link` first.

> **Redeploy afterwards.** Vercel applies environment variables at build time, so adding
> them does nothing to the deployment already serving traffic. Run `vercel --prod`, or push
> a commit.

`vercel.json` registers two cron jobs. Vercel sends `Authorization: Bearer $CRON_SECRET`
automatically, which is exactly what `/api/cron` checks.

| Job | Schedule (UTC) | What it does |
|---|---|---|
| `?job=generate` | `0 9 * * *` | Materialises the next two weeks of recurring occurrences. |
| `?job=post-summary` | `0 1 * * 2-6` | Posts each person's end-of-day summary. |

Vercel cron runs in **UTC**. `0 1` on Tue–Sat is 6pm Pacific in summer and 5pm in winter,
Mon–Fri. Adjust if you want it pinned to one local hour year-round. The Hobby plan allows two
cron jobs at daily frequency, which is exactly what this uses; anything more granular needs
Pro.

Automatic posting is **off** until a manager turns it on in `/settings`. Until then the
summary is posted with a deliberate click on `/summary`.

### 4. Teams

**A channel** can take an Incoming Webhook: **⋯ → Workflows → "Post to a channel when a
webhook request is received"**. Leave the Message format on *Detect*.

**A group chat cannot.** Connectors only attach to channels, so a chat needs a Power Automate
flow with a **When an HTTP request is received** trigger. Set the Message format to
*Simple JSON* for one of those.

Either way the URL goes in `/settings` (or `TEAMS_WEBHOOK_URL`), then press **Send a test
message**. The whole URL is a credential — it ends in a `&sig=` signature.

For a hand-built flow:

```bash
npm run teams:payload
```

That prints the exact request body and its JSON Schema, generated by calling the app's real
`buildPayload`, so it cannot drift from what is actually sent.

Two things reliably go wrong here:

- **Paste the schema into the trigger's "Request Body JSON Schema" box.** If you use
  *Use sample payload to generate schema* instead, paste the **sample body**, not the schema —
  otherwise Power Automate builds a schema *of the schema* and the dynamic content tokens come
  out named `type` and `Item`.
- **Map the `html` field into the Message box**, not `text`. That box is rich text and renders
  HTML; Markdown posts with literal `**` around every bold word. The payload carries the same
  message as `html`, `text` (Markdown) and `body` (Markdown, no title) so the flow can take
  whichever its destination wants.

A 400 response means the body shape is wrong, not the URL.

---

## How the recurrence model works

The two-table split is the whole design:

- **`Task`** is the *definition*: "Check SEO rankings", monthly, on the 1st, high priority.
- **`TaskOccurrence`** is one concrete instance of it, due on one date, with its own status and
  its own time entries.

A one-off task has exactly one occurrence. A recurring task gets a new one each cycle, created
ahead of time out to a two-week horizon by `ensureOccurrences()`.

That function is **idempotent** — a unique constraint on `[taskId, dueDate]` means running it
twice changes nothing — so it is safe to call on page load as well as from cron. It also
deliberately **does not skip a cycle when the previous one is still open**. If September's SEO
check never happened, October's row appears anyway and both sit there overdue. Hiding the
backlog is the exact failure this app exists to prevent.

Time is credited to a **business date** in the office timezone, kept separate from the
timestamp it was entered. Logging Tuesday's work on Thursday still counts toward Tuesday, and
a timer running past midnight counts toward the day it started.

---

## Design

Every colour, size, radius and shadow comes from the shared Right Click design system,
transcribed into CSS custom properties in `src/app/globals.css`. Mulish is self-hosted from
`public/fonts`. The brand lockups in `public/brand` are the official assets in the correct
light and dark colourways.

The one deviation worth naming: the brand ramps are essentially a single hue, which cannot
carry seven visually distinct chart categories. The categorical palette in
`src/components/Charts.tsx` is anchored on brand blue and extended with steps validated for
colourblind separation, lightness and chroma against a light surface.
