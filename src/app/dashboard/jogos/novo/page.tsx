import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GameAdminForm } from "@/components/games/game-admin-form";
import { loadAdminOptions } from "@/modules/games/admin";

export default async function NovoJogoPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/dashboard/jogos");
  const opts = await loadAdminOptions();
  return (
    <div className="space-y-4">
      <Link href="/dashboard/jogos" className="text-sm font-semibold text-primary underline">← Todos os jogos</Link>
      <h1 className="font-heading text-2xl font-bold">Novo jogo</h1>
      <GameAdminForm game={null} {...opts} />
    </div>
  );
}
