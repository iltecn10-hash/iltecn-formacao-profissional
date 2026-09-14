import { describe, it, expect } from "vitest";
import { sanitizeJsonValue } from "@/lib/sanitize-json";

describe("sanitizeJsonValue", () => {
  it("mantém objetos e arrays normais intactos", () => {
    const input = { a: 1, b: { c: [1, 2, { d: "x" }] } };
    expect(sanitizeJsonValue(input)).toEqual(input);
  });

  it("remove uma chave __proto__ própria de um objeto plano", () => {
    const malicious = JSON.parse('{"a": 1, "__proto__": {"polluted": true}}');
    const clean = sanitizeJsonValue(malicious) as Record<string, unknown>;
    expect(clean.a).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(clean, "__proto__")).toBe(false);
    // garante que a poluição de fato não aconteceu no protótipo global
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("remove __proto__/constructor/prototype em profundidade, dentro de arrays", () => {
    const malicious = JSON.parse(
      '{"rich":{"body":{"attrs":{"__proto__":{"x":1}}}},"list":[{"constructor":{"y":2}}]}'
    );
    const clean = sanitizeJsonValue(malicious) as {
      rich: { body: { attrs: Record<string, unknown> } };
      list: Record<string, unknown>[];
    };
    expect(Object.keys(clean.rich.body.attrs)).toHaveLength(0);
    expect(Object.keys(clean.list[0])).toHaveLength(0);
  });

  it("não altera valores primitivos e null", () => {
    expect(sanitizeJsonValue(42)).toBe(42);
    expect(sanitizeJsonValue("texto")).toBe("texto");
    expect(sanitizeJsonValue(null)).toBeNull();
  });
});
