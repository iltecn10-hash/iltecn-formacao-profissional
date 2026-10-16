import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
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

  return (
    <AppShell role={session.role} name={session.name} kids={kids}>
      {children}
    </AppShell>
  );
}
