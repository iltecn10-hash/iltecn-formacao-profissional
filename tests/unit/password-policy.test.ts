import { describe, it, expect } from "vitest";
import { validateNewPassword, generateTemporaryPassword } from "@/lib/password-policy";

describe("validateNewPassword", () => {
  it("equipe: exige 8+ caracteres, letra e número, e recusa senhas óbvias", () => {
    expect(validateNewPassword("admin", "123456")).toMatch(/8 caracteres/);
    expect(validateNewPassword("admin", "abcdefgh")).toMatch(/letras e números/);
    expect(validateNewPassword("teacher", "12345678")).toMatch(/letras e números/);
    expect(validateNewPassword("coordinator", "Escola2026x")).toBeNull();
    expect(validateNewPassword("admin", "iltecn2026")).toMatch(/comum/);
    expect(validateNewPassword("admin", "Escola#Segura9")).toBeNull();
  });
  it("aluno: basta 6 caracteres", () => {
    expect(validateNewPassword("student", "12345")).toMatch(/6 caracteres/);
    expect(validateNewPassword("student", "123456")).toBeNull();
  });
  it("limita o tamanho (bcrypt só usa 72 bytes)", () => {
    expect(validateNewPassword("student", "a".repeat(73))).toMatch(/72/);
  });
  it("senha provisória: 8 caracteres sem ambíguos", () => {
    for (let i = 0; i < 20; i++) expect(generateTemporaryPassword()).toMatch(/^[a-z2-9]{8}$/);
  });
});
