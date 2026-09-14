import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listInbox, listSent, sendMessage } from "@/modules/messages/queries";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const box = request.nextUrl.searchParams.get("box") ?? "inbox";
  const messages =
    box === "sent"
      ? await listSent(session.userId)
      : await listInbox(session.userId);

  return NextResponse.json({ messages });
}

const sendSchema = z.object({
  recipientId: z.string().uuid("Selecione um destinatário."),
  subject: z.string().min(1, "Assunto é obrigatório."),
  body: z.string().min(1, "Escreva uma mensagem."),
  attachmentUrl: z.string().url("Link inválido.").optional().or(z.literal("")),
  parentMessageId: z.string().uuid().optional(),
  isForward: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const message = await sendMessage({
    senderId: session.userId,
    recipientId: parsed.data.recipientId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    attachmentUrl: parsed.data.attachmentUrl || undefined,
    parentMessageId: parsed.data.parentMessageId,
    isForward: parsed.data.isForward,
  });

  return NextResponse.json({ message }, { status: 201 });
}
