import { randomInt } from "crypto";
import type { UserRole } from "@/types";

const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "password", "senha123",
  "senha1234", "qwerty123", "iltecn2026", "iltecn123", "admin123", "abc12345",
]);

/**
 * Regra da NOVA senha escolhida pelo próprio usuário. Aluno: mínimo 6 (crianças digitam
 * a senha); equipe: mínimo 8, com letra e número, e fora de uma lista de senhas óbvias.
 * Devolve a mensagem de erro, ou null se a senha serve.
 */
export function validateNewPassword(role: UserRole, password: string): string | null {
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (role === "student") {
    return password.length >= 6 ? null : "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use letras e números na senha.";
  }
  if (COMMON.has(password.toLowerCase())) return "Essa senha é muito comum. Escolha outra.";
  return null;
}

// Sem caracteres ambíguos (0/O, 1/l/I) — a senha provisória é ditada ou digitada por crianças.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
