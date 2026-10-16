import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getPositionByUserId, POSITION_LABEL } from "@/modules/coordination/queries";
import { isKidsStudent } from "@/modules/students/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const kids = session.role === "student" && (await isKidsStudent(session.userId));

  const position = session.role === "coordinator" ? await getPositionByUserId(session.userId) : null;

  return (
    <AppShell
      role={session.role}
      name={session.name}
      kids={kids}
      roleLabel={position ? POSITION_LABEL[position] : undefined}
    >
      {children}
    </AppShell>
  );
}
