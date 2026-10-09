import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GameAdminForm } from "@/components/games/game-admin-form";
import { getAdminGame, loadAdminOptions } from "@/modules/games/admin";

export default async function EditarJogoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/dashboard/jogos");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [game, opts] = await Promise.all([getAdminGame(id), loadAdminOptions()]);
  if (!game) notFound();
  return (
    <div className="space-y-4">
      <Link href="/dashboard/jogos" className="text-sm font-semibold text-primary underline">← Todos os jogos</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold">Editar: {game.title}</h1>
        <Link href={`/dashboard/jogos/${game.id}`} className="font-semibold text-primary underline">Ver resultados</Link>
      </div>
      <GameAdminForm game={game} {...opts} />
    </div>
  );
}
