import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { LAB_TRACK_SLUG } from "@/modules/lab/queries";
import { LabContentAdmin } from "@/components/lab/content-admin";

export default async function LabConteudoPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/dashboard");

  const lessons = await query<{ id: string; number: number; title: string }>(
    `SELECT m.id, m.sort_order AS number, m.title
     FROM missions m JOIN modules mo ON mo.id = m.module_id JOIN tracks t ON t.id = mo.track_id
     WHERE t.slug = $1 ORDER BY m.sort_order ASC`,
    [LAB_TRACK_SLUG]
  );

  return (
    <div className="space-y-4">
      <Link href="/dashboard/lab" className="text-sm font-semibold text-primary underline">← Acompanhamento</Link>
      <h1 className="font-heading text-2xl font-bold">ILTECN LAB — Conteúdo das aulas</h1>
      <p className="text-sm text-muted">
        Aqui você ajusta as atividades de cada aula. Textos e vídeos da aula continuam na tela <Link href="/dashboard/formacao" className="underline">Formação</Link>.
        &quot;Desativar&quot; esconde a atividade dos alunos sem apagar o histórico de quem já fez.
      </p>
      <LabContentAdmin lessons={lessons.map((l) => ({ ...l, number: Number(l.number) }))} />
    </div>
  );
}
