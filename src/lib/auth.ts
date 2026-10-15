import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/types";

const COOKIE_NAME = "iltecn_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não está definida. Configure o .env.local.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Sessão válida = token assinado E usuário ainda ativo no banco. O papel (role) vem do banco, não do
 * token: desativar um usuário ou mudar o papel dele vale na hora, sem esperar os 7 dias do cookie.
 * Falha fechada: se o banco não responder, não há sessão.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return null;
  try {
    const { queryOne } = await import("@/lib/db"); // import tardio: auth.ts também é carregado fora do Node em testes
    const user = await queryOne<{ active: boolean; role: SessionPayload["role"]; name: string; email: string }>(
      `SELECT active, role, name, email FROM users WHERE id = $1::uuid`, [payload.userId]);
    if (!user || !user.active) return null;
    return { userId: payload.userId, email: user.email, name: user.name, role: user.role };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
