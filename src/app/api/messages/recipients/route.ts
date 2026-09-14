import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecipientOptions } from "@/modules/messages/queries";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const recipients = await listRecipientOptions(session.userId);
  return NextResponse.json({ recipients });
}
