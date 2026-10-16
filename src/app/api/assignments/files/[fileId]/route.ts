import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getFileForDownload } from "@/modules/assignments/queries";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { fileId } = await params;
  if (!z.string().uuid().safeParse(fileId).success) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  const file = await getFileForDownload({ userId: session.userId, role: session.role }, fileId);
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  const ascii = file.file_name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime_type,
      // Sempre baixar (nunca abrir no site) e proibir o navegador de "adivinhar" o tipo.
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
