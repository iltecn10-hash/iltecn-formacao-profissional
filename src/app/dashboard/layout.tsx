import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";
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
    <div className="flex min-h-screen w-full">
      <SidebarNav role={session.role} name={session.name} kids={kids} />
      <main className="flex-1 overflow-y-auto bg-background px-8 py-8 lg:px-12">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
