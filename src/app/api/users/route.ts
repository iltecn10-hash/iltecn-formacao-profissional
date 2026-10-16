import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listManagedUsers } from "@/modules/users/queries";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "student") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const users = await listManagedUsers({ userId: session.userId, role: session.role });
  return NextResponse.json({ users });
}
