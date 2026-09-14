const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Remove recursivamente chaves perigosas (`__proto__`, `constructor`,
 * `prototype`) de um valor vindo de JSON não confiável (conteúdo de editor
 * enviado pelo aluno via API).
 *
 * Mitiga o mesmo vetor do aviso GHSA-cp6q-959q-f8rh do Tiptap
 * (`mergeAttributes()` tratando uma chave `__proto__` própria como atributos
 * de DOM herdados e executáveis): mesmo que a versão instalada do
 * `@tiptap/core` seja vulnerável, o conteúdo nunca chega ao banco (e,
 * portanto, nunca chega a ser renderizado de volta) com essas chaves.
 */
export function sanitizeJsonValue<T>(value: T): T {
  return sanitize(value, new WeakSet()) as T;
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  if (value !== null && typeof value === "object") {
    if (seen.has(value as object)) return {};
    seen.add(value as object);

    const clean: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      clean[key] = sanitize((value as Record<string, unknown>)[key], seen);
    }
    return { ...clean };
  }

  return value;
}
