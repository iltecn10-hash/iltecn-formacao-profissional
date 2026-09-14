import { describe, it, expect } from "vitest";
import {
  DOCUMENT_TEMPLATES,
  getDocumentTemplate,
  getFieldDefs,
  FREEFORM_BODY_FIELD,
} from "@/lib/document-templates";

describe("document-templates (Fase 9, seção 5)", () => {
  it("define os 5 modelos pedagógicos previstos", () => {
    const keys = DOCUMENT_TEMPLATES.map((t) => t.key).sort();
    expect(keys).toEqual(
      ["comunicado", "declaracao", "memorando", "relatorio", "requerimento"].sort()
    );
  });

  it("cada modelo tem pelo menos um campo obrigatório do tipo richtext", () => {
    for (const template of DOCUMENT_TEMPLATES) {
      const hasRichRequired = template.fields.some(
        (f) => f.kind === "richtext" && f.required
      );
      expect(hasRichRequired, `${template.key} deveria ter um campo richtext obrigatório`).toBe(
        true
      );
    }
  });

  it("getDocumentTemplate retorna null para chave inexistente ou vazia", () => {
    expect(getDocumentTemplate("nao-existe")).toBeNull();
    expect(getDocumentTemplate(null)).toBeNull();
    expect(getDocumentTemplate(undefined)).toBeNull();
  });

  it("getFieldDefs cai para o campo livre quando não há modelo", () => {
    expect(getFieldDefs(null)).toEqual([FREEFORM_BODY_FIELD]);
    expect(getFieldDefs("modelo-inexistente")).toEqual([FREEFORM_BODY_FIELD]);
  });

  it("getFieldDefs retorna os campos do modelo memorando", () => {
    const fields = getFieldDefs("memorando");
    expect(fields.map((f) => f.key)).toEqual([
      "numero",
      "data",
      "destinatario",
      "remetente",
      "assunto",
      "conteudo",
    ]);
  });
});
