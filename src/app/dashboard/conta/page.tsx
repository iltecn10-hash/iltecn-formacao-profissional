import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="max-w-xl">
      <h1 className="font-heading text-2xl font-bold text-foreground">Minha conta</h1>
      <div className="mt-4 card p-5 text-sm">
        <p className="text-muted">Nome</p>
        <p className="font-medium text-foreground">{session.name}</p>
        <p className="mt-3 text-muted">Login (e-mail)</p>
        <p className="font-medium text-foreground">{session.email}</p>
      </div>

      <div className="mt-6 card p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Alterar senha</h2>
        <div className="mt-4">
          <ChangePasswordForm isStudent={session.role === "student"} />
        </div>
      </div>
    </div>
  );
}
