import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMessageForUser } from "@/modules/messages/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const message = await getMessageForUser(id, session.userId);
  if (!message) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ message });
}
