import { getSession } from "@/lib/auth";
import { EmailApp } from "@/components/email-app";

export default async function EmailPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        E-mail (simulado)
      </h1>
      <p className="mt-1 text-muted">
        Ambiente de prática de comunicação profissional. Nenhuma mensagem sai
        da plataforma.
      </p>

      <EmailApp currentUserId={session.userId} />
    </div>
  );
}
