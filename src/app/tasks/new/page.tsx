import { AppShell } from "@/components/AppShell";
import { TaskForm } from "@/components/TaskForm";
import { PageHeader } from "@/components/ui";
import { createTask } from "@/actions/tasks";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { businessToday, toDateInput } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "New task" };

export default async function NewTaskPage() {
  const user = await requireUser();
  const [categories, people] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell user={user}>
      <PageHeader
        title="Add a task"
        lede="One-off or recurring. Recurring work reappears on its own schedule and stays on the board until somebody closes it."
      />
      <TaskForm
        action={createTask}
        categories={categories}
        people={people}
        submitLabel="Add task"
        initial={{
          title: "",
          description: "",
          categoryId: "",
          priority: "MEDIUM",
          cadence: "NONE",
          interval: 1,
          anchorDay: null,
          startDate: toDateInput(businessToday()),
          endDate: "",
          estimateMinutes: "",
          assigneeId: "",
        }}
      />
    </AppShell>
  );
}
