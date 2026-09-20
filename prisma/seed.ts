/**
 * Seeds the categories and a starter set of recurring marketing work — the
 * kind of thing that gets asked for once and then quietly stops happening.
 * Safe to run more than once: everything is keyed on the task title.
 */
import { PrismaClient, type Cadence, type Priority } from "@prisma/client";

const prisma = new PrismaClient();

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
  anchorDay?: number;
  estimateMinutes?: number;
};

const TASKS: SeedTask[] = [
  {
    title: "Check SEO rankings and flag pages that slipped",
    description:
      "Pull the tracked keyword set, compare against last month, and list any page that dropped more than three positions. Note what changed on those pages.",
    category: "SEO",
    priority: "HIGH",
    cadence: "MONTHLY",
    anchorDay: 1,
    estimateMinutes: 90,
  },
  {
    title: "Review ad spend against budget",
    description:
      "Every channel: what was spent this week, what it returned, and whether anything is pacing over. Flag anything that needs a decision.",
    category: "Paid ads",
    priority: "HIGH",
    cadence: "WEEKLY",
    anchorDay: 1,
    estimateMinutes: 45,
  },
  {
    title: "Post the monthly performance report",
    description: "Traffic, leads, spend and pipeline for the month, with a short note on what moved.",
    category: "Reporting",
    priority: "HIGH",
    cadence: "MONTHLY",
    anchorDay: 3,
    estimateMinutes: 120,
  },
  {
    title: "Publish the client newsletter",
    description: "Draft, get a review, send. Include one client story and one security item.",
    category: "Email",
    priority: "MEDIUM",
    cadence: "MONTHLY",
    anchorDay: 15,
    estimateMinutes: 180,
  },
  {
    title: "Schedule next week's social posts",
    description: "Three to five posts across LinkedIn. Mix of company news, hiring and useful IT advice.",
    category: "Social",
    priority: "MEDIUM",
    cadence: "WEEKLY",
    anchorDay: 5,
    estimateMinutes: 60,
  },
  {
    title: "Check the website for broken links and stale pages",
    description: "Crawl the site, fix broken links, and list any page whose content is more than a year old.",
    category: "Website",
    priority: "LOW",
    cadence: "MONTHLY",
    anchorDay: 20,
    estimateMinutes: 60,
  },
  {
    title: "Review Google Business Profile and respond to reviews",
    description: "Reply to every new review. Check the profile details are still correct.",
    category: "SEO",
    priority: "MEDIUM",
    cadence: "BIWEEKLY",
    anchorDay: 2,
    estimateMinutes: 30,
  },
  {
    title: "Quarterly competitor scan",
    description: "What the other Southern California MSPs are publishing, ranking for and advertising on.",
    category: "Content",
    priority: "LOW",
    cadence: "QUARTERLY",
    anchorDay: 10,
    estimateMinutes: 180,
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
  console.log(`Categories ready: ${CATEGORIES.length}`);

  const categoryIds = new Map(
    (await prisma.category.findMany()).map((c) => [c.name, c.id] as const),
  );

  let created = 0;
  for (const t of TASKS) {
    const existing = await prisma.task.findFirst({ where: { title: t.title } });
    if (existing) continue;

    await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        categoryId: categoryIds.get(t.category) ?? null,
        priority: t.priority,
        cadence: t.cadence,
        interval: 1,
        anchorDay: t.anchorDay ?? null,
        estimateMinutes: t.estimateMinutes ?? null,
      },
    });
    created++;
  }
  console.log(`Recurring tasks created: ${created}`);
  console.log("Run the app (or the cron job) to materialise the first occurrences.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
