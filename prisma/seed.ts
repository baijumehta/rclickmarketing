/**
 * The standing marketing cadence for an MSP.
 *
 * This is the recurring work a marketing function should be doing whether or
 * not anyone asks for it. It is deliberately sized for one person: roughly
 * eight to nine hours a week of recurring commitments, leaving the rest of
 * the week for campaigns, projects and whatever comes up.
 *
 * Idempotent — keyed on task title, so running it again updates the existing
 * definitions rather than duplicating them.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Cadence, type Priority } from "@prisma/client";

const prisma = new PrismaClient();

/** Seven categories, matching the seven validated chart colours. */
const CATEGORIES = [
  { name: "SEO", color: "#0098d5" },
  { name: "Paid ads", color: "#e2603f" },
  { name: "Content", color: "#a563c9" },
  { name: "Social", color: "#17a673" },
  { name: "Email", color: "#e0961c" },
  { name: "Website", color: "#6b5bd2" },
  { name: "Reporting", color: "#00a3ad" },
];

type SeedTask = {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  cadence: Cadence;
  /** 0=Sun..6=Sat for weekly cadences; day of month for monthly and longer. */
  anchorDay?: number;
  estimateMinutes: number;
  /** Pins the first occurrence for cadences where the month matters. */
  startDate?: string;
};

const TASKS: SeedTask[] = [
  // ---------------------------------------------------------------- weekly
  {
    title: "Check every new lead reached a human",
    description:
      "Walk the week's enquiries from the form or phone through to whoever owns the follow-up. Any lead with no owner or no response inside a day is the finding. This is the cheapest marketing work there is: leads already paid for and then dropped.",
    category: "Reporting",
    priority: "HIGH",
    cadence: "WEEKLY",
    anchorDay: 1,
    estimateMinutes: 30,
  },
  {
    title: "Test the contact and quote forms end to end",
    description:
      "Submit each form as a stranger would. Confirm the notification arrives, the CRM record is created, and the thank-you page fires its conversion. Forms break silently after plugin and DNS changes, and nobody finds out until a month of leads is gone.",
    category: "Website",
    priority: "HIGH",
    cadence: "WEEKLY",
    anchorDay: 1,
    estimateMinutes: 15,
  },
  {
    title: "Review ad spend and pacing against budget",
    description:
      "Every channel: spent this week, leads returned, cost per lead, and whether anything is pacing over for the month. Flag anything needing a decision rather than quietly absorbing it.",
    category: "Paid ads",
    priority: "HIGH",
    cadence: "WEEKLY",
    anchorDay: 1,
    estimateMinutes: 45,
  },
  {
    title: "Review search terms and add negative keywords",
    description:
      "Read what people actually typed to trigger the ads. Add negatives for the irrelevant ones — job seekers, DIY, home users, competitors' brand names. Skipping this is how a third of the budget goes to traffic that was never going to buy.",
    category: "Paid ads",
    priority: "MEDIUM",
    cadence: "WEEKLY",
    anchorDay: 3,
    estimateMinutes: 30,
  },
  {
    title: "Schedule next week's social posts",
    description:
      "Three to five posts. Mix company news, hiring, a client outcome and one genuinely useful IT or security point. Queue them so the week does not depend on finding time.",
    category: "Social",
    priority: "MEDIUM",
    cadence: "WEEKLY",
    anchorDay: 5,
    estimateMinutes: 60,
  },

  // -------------------------------------------------------------- biweekly
  {
    title: "Publish an article",
    description:
      "One piece answering a question clients actually ask. Aim at the verticals Right Click serves — AEC, healthcare, aerospace and defense — and at compliance, where buyers search hardest. Consistency matters more than length.",
    category: "Content",
    priority: "HIGH",
    cadence: "BIWEEKLY",
    anchorDay: 3,
    estimateMinutes: 180,
  },
  {
    title: "Respond to reviews and check the Google Business Profile",
    description:
      "Reply to every review, positive and negative. Confirm hours, services, photos and contact details are still right. For local search this profile does more work than the website.",
    category: "SEO",
    priority: "MEDIUM",
    cadence: "BIWEEKLY",
    anchorDay: 2,
    estimateMinutes: 30,
  },

  // --------------------------------------------------------------- monthly
  {
    title: "Check SEO rankings and flag pages that slipped",
    description:
      "Pull the tracked keyword set and compare against last month. List any page that dropped more than three positions and note what changed on it. Rankings drift slowly; monthly is the cadence that catches it while it is still cheap to fix.",
    category: "SEO",
    priority: "HIGH",
    cadence: "MONTHLY",
    anchorDay: 1,
    estimateMinutes: 90,
  },
  {
    title: "Post the monthly performance report",
    description:
      "Traffic, leads, cost per lead, spend and pipeline for the month, with a short note on what moved and why. Two or three sentences of interpretation is worth more than another chart.",
    category: "Reporting",
    priority: "HIGH",
    cadence: "MONTHLY",
    anchorDay: 3,
    estimateMinutes: 120,
  },
  {
    title: "Review analytics for anomalies",
    description:
      "Compare traffic, sources and conversions against the prior month. Chase anything that moved more than about 20% — a tracking break and a genuine change look identical on the surface and need telling apart.",
    category: "Reporting",
    priority: "MEDIUM",
    cadence: "MONTHLY",
    anchorDay: 5,
    estimateMinutes: 60,
  },
  {
    title: "Verify tracking: analytics, tag manager, call tracking and form alerts",
    description:
      "Confirm every conversion path still records. Check the tag manager container, call tracking numbers and form notification addresses. Broken tracking does not announce itself; it just makes a good month look bad.",
    category: "Website",
    priority: "HIGH",
    cadence: "MONTHLY",
    anchorDay: 8,
    estimateMinutes: 60,
  },
  {
    title: "Ask account managers for a client win to write up",
    description:
      "A short round of the service team for anything worth telling: a migration that went well, an incident handled, an audit passed. Collect it while it is fresh — this is the raw material for every case study and post.",
    category: "Content",
    priority: "MEDIUM",
    cadence: "MONTHLY",
    anchorDay: 10,
    estimateMinutes: 30,
  },
  {
    title: "Publish the client newsletter",
    description:
      "Draft, get a review, send. One client story, one security or compliance item, and anything clients genuinely need to know. Keep it short enough to read on a phone.",
    category: "Email",
    priority: "MEDIUM",
    cadence: "MONTHLY",
    anchorDay: 15,
    estimateMinutes: 180,
  },
  {
    title: "Check the website for broken links and stale pages",
    description:
      "Crawl the site, fix broken links, and list any page whose content is more than a year old. Stale pricing, retired services and dead team members all quietly cost credibility.",
    category: "Website",
    priority: "LOW",
    cadence: "MONTHLY",
    anchorDay: 20,
    estimateMinutes: 60,
  },
  {
    title: "Review the top landing pages for conversion",
    description:
      "Take the five pages with the most traffic. For each: is the offer clear, is there one obvious next step, does it load fast on a phone. Small fixes here beat new traffic.",
    category: "Website",
    priority: "MEDIUM",
    cadence: "MONTHLY",
    anchorDay: 22,
    estimateMinutes: 90,
  },

  // ------------------------------------------------------------- quarterly
  {
    title: "Claim partner co-op and MDF funds",
    description:
      "Check what marketing development funds are available through Microsoft and the other vendor programs, what has been claimed, and what expires this quarter. This is budget already earned; it is routinely left on the table because nobody owns the deadline.",
    category: "Reporting",
    priority: "HIGH",
    cadence: "QUARTERLY",
    anchorDay: 5,
    estimateMinutes: 90,
  },
  {
    title: "Competitor scan: content, rankings and ad copy",
    description:
      "What the other Southern California MSPs are publishing, ranking for and advertising on. Looking for gaps worth taking, not for things to copy.",
    category: "Content",
    priority: "LOW",
    cadence: "QUARTERLY",
    anchorDay: 10,
    estimateMinutes: 180,
  },
  {
    title: "Publish a client case study",
    description:
      "One story with real numbers and a named client where possible. Problem, what was done, what changed. Case studies close deals that blog posts only start.",
    category: "Content",
    priority: "HIGH",
    cadence: "QUARTERLY",
    anchorDay: 12,
    estimateMinutes: 240,
  },
  {
    title: "Website speed and Core Web Vitals audit",
    description:
      "Measure on a phone on a normal connection, not a desk machine. Fix the worst offenders — usually images and third-party scripts. Speed affects both rankings and whether anyone waits around.",
    category: "Website",
    priority: "MEDIUM",
    cadence: "QUARTERLY",
    anchorDay: 15,
    estimateMinutes: 120,
  },
  {
    title: "Review keyword strategy against what clients actually ask",
    description:
      "Compare the tracked keywords with the questions coming into sales and the service desk. Real buyer language beats keyword tools, and it drifts as the services do.",
    category: "SEO",
    priority: "MEDIUM",
    cadence: "QUARTERLY",
    anchorDay: 18,
    estimateMinutes: 90,
  },
  {
    title: "Refresh the best-performing articles",
    description:
      "Take the three pieces pulling the most traffic and bring them up to date: current figures, current screenshots, current advice. Updating what already ranks is cheaper than writing something new that might.",
    category: "Content",
    priority: "MEDIUM",
    cadence: "QUARTERLY",
    anchorDay: 20,
    estimateMinutes: 120,
  },
  {
    title: "Plan next quarter's campaign theme",
    description:
      "One theme, one vertical, one offer. Decide what gets written, promoted and measured, and what is deliberately not being done. A plan that does not exclude anything is not a plan.",
    category: "Content",
    priority: "HIGH",
    cadence: "QUARTERLY",
    anchorDay: 25,
    estimateMinutes: 180,
  },
  {
    title: "Sales and marketing alignment review",
    description:
      "Sit with sales: which leads were worth having, which were not, and what they keep getting asked that marketing should answer first. Thirty minutes here redirects a quarter of work.",
    category: "Reporting",
    priority: "MEDIUM",
    cadence: "QUARTERLY",
    anchorDay: 28,
    estimateMinutes: 60,
  },

  // ------------------------------------------------------------ semiannual
  {
    title: "Full website content audit",
    description:
      "Every page: keep, rewrite, merge or delete. Services that no longer exist, pricing that moved, claims that can no longer be supported. Most sites carry a third more pages than they need.",
    category: "Website",
    priority: "MEDIUM",
    cadence: "SEMIANNUAL",
    anchorDay: 1,
    estimateMinutes: 300,
  },
  {
    title: "Client satisfaction survey and write-up",
    description:
      "Short survey to the client base, then a written summary of what came back. Doubles as the source of testimonials and as an early warning on accounts going quiet.",
    category: "Reporting",
    priority: "MEDIUM",
    cadence: "SEMIANNUAL",
    anchorDay: 15,
    estimateMinutes: 180,
  },

  // ---------------------------------------------------------------- annual
  {
    title: "Renew domains, certificates and marketing subscriptions",
    description:
      "Every domain, SSL certificate and marketing tool in one list with its renewal date and owner. An expired domain is a bad afternoon for an IT company in particular.",
    category: "Website",
    priority: "HIGH",
    cadence: "ANNUAL",
    anchorDay: 10,
    estimateMinutes: 60,
    startDate: "2026-10-10",
  },
  {
    title: "Marketing plan and budget for the year",
    description:
      "Targets, channels, spend and what success looks like by quarter. Written down, agreed, and revisited rather than reinvented each January.",
    category: "Reporting",
    priority: "HIGH",
    cadence: "ANNUAL",
    anchorDay: 1,
    estimateMinutes: 480,
    startDate: "2026-11-01",
  },
  {
    title: "Refresh brand photography and video",
    description:
      "Team shots, office, and anything client-facing that has aged. Stock photography of strangers in a server room is worse than nothing.",
    category: "Content",
    priority: "LOW",
    cadence: "ANNUAL",
    anchorDay: 15,
    estimateMinutes: 240,
    startDate: "2027-03-15",
  },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: { color: c.color },
      create: c,
    });
  }
  console.log(`Categories: ${CATEGORIES.length}`);

  const categoryIds = new Map(
    (await prisma.category.findMany()).map((c) => [c.name, c.id] as const),
  );

  let created = 0;
  let updated = 0;

  for (const t of TASKS) {
    const data = {
      description: t.description,
      categoryId: categoryIds.get(t.category) ?? null,
      priority: t.priority,
      cadence: t.cadence,
      interval: 1,
      anchorDay: t.anchorDay ?? null,
      estimateMinutes: t.estimateMinutes,
      archivedAt: null,
      ...(t.startDate ? { startDate: new Date(`${t.startDate}T00:00:00.000Z`) } : {}),
    };

    const existing = await prisma.task.findFirst({ where: { title: t.title } });
    if (existing) {
      await prisma.task.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.task.create({ data: { title: t.title, ...data } });
      created++;
    }
  }

  // Retire earlier seeded tasks that the catalogue has renamed or dropped,
  // otherwise "Review ad spend against budget" sits next to "Review ad spend
  // and pacing against budget" forever.
  //
  // Only ever touches tasks with no creator (seeded, never added by a person)
  // and no logged time, so real work is never deleted.
  const titles = TASKS.map((t) => t.title);
  const orphans = await prisma.task.findMany({
    where: {
      title: { notIn: titles },
      createdById: null,
      occurrences: { none: { timeEntries: { some: {} } } },
    },
    select: { id: true, title: true },
  });

  if (orphans.length) {
    await prisma.task.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
    console.log(`Retired ${orphans.length} superseded task(s): ${orphans.map((o) => o.title).join(", ")}`);
  }

  const weekly = TASKS.filter((t) => t.cadence === "WEEKLY").reduce((s, t) => s + t.estimateMinutes, 0);
  const biweekly = TASKS.filter((t) => t.cadence === "BIWEEKLY").reduce((s, t) => s + t.estimateMinutes, 0);
  const monthly = TASKS.filter((t) => t.cadence === "MONTHLY").reduce((s, t) => s + t.estimateMinutes, 0);
  const perWeek = weekly + biweekly / 2 + monthly / 4.33;

  console.log(`Tasks: ${created} created, ${updated} updated, ${TASKS.length} total`);
  console.log(
    `Recurring load: about ${(perWeek / 60).toFixed(1)}h a week before quarterly and annual work.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
