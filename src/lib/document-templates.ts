/**
 * Modelos pedagógicos de documento (Fase 9, seção 5).
 *
 * Cada modelo declara campos estruturados (número, data, destinatário, etc.)
 * que ficam fora do corpo de texto rico — só o campo "conteúdo"/"introdução"
 * principal usa o editor Tiptap. Isso mantém os documentos previsíveis o
 * bastante para uma futura avaliação automática (Fase 9.5) sem exigir que o
 * aluno formate a estrutura inteira do zero.
 */

export type DocumentTemplateKey =
  | "memorando"
  | "requerimento"
  | "declaracao"
  | "relatorio"
  | "comunicado";

export interface DocumentFieldDef {
  key: string;
  label: string;
  kind: "text" | "date" | "richtext";
  placeholder?: string;
  required?: boolean;
}

export interface DocumentTemplateDef {
  key: DocumentTemplateKey;
  label: string;
  description: string;
  fields: DocumentFieldDef[];
}

export const DOCUMENT_TEMPLATES: DocumentTemplateDef[] = [
  {
    key: "memorando",
    label: "Memorando",
    description: "Comunicação interna curta e objetiva entre setores.",
    fields: [
      { key: "numero", label: "Número", kind: "text", placeholder: "Ex: 012/2026", required: true },
      { key: "data", label: "Data", kind: "date", required: true },
      { key: "destinatario", label: "Destinatário", kind: "text", required: true },
      { key: "remetente", label: "Remetente", kind: "text", required: true },
      { key: "assunto", label: "Assunto", kind: "text", required: true },
      { key: "conteudo", label: "Conteúdo", kind: "richtext", required: true },
    ],
  },
  {
    key: "requerimento",
    label: "Requerimento",
    description: "Pedido formal dirigido a um setor ou responsável.",
    fields: [
      { key: "requerente", label: "Requerente", kind: "text", required: true },
      { key: "assunto", label: "Assunto", kind: "text", required: true },
      { key: "solicitacao", label: "Solicitação", kind: "richtext", required: true },
      { key: "justificativa", label: "Justificativa", kind: "richtext", required: true },
      { key: "data", label: "Data", kind: "date", required: true },
      { key: "assinatura", label: "Assinatura", kind: "text", required: true },
    ],
  },
  {
    key: "declaracao",
    label: "Declaração",
    description: "Afirmação formal de um fato para um determinado fim.",
    fields: [
      { key: "nome", label: "Nome", kind: "text", required: true },
      { key: "finalidade", label: "Finalidade", kind: "text", required: true },
      { key: "conteudo", label: "Conteúdo", kind: "richtext", required: true },
      { key: "data", label: "Data", kind: "date", required: true },
      { key: "assinatura", label: "Assinatura", kind: "text", required: true },
    ],
  },
  {
    key: "relatorio",
    label: "Relatório",
    description: "Registro estruturado de um período ou atividade.",
    fields: [
      { key: "titulo", label: "Título", kind: "text", required: true },
      { key: "periodo", label: "Período", kind: "text", required: true },
      { key: "responsavel", label: "Responsável", kind: "text", required: true },
      { key: "introducao", label: "Introdução", kind: "richtext", required: true },
      { key: "dados", label: "Dados", kind: "richtext", required: true },
      { key: "analise", label: "Análise", kind: "richtext", required: true },
      { key: "conclusao", label: "Conclusão", kind: "richtext", required: true },
    ],
  },
  {
    key: "comunicado",
    label: "Comunicado",
    description: "Aviso direcionado a um público específico.",
    fields: [
      { key: "titulo", label: "Título", kind: "text", required: true },
      { key: "destinatario", label: "Destinatário", kind: "text", required: true },
      { key: "mensagem", label: "Mensagem", kind: "richtext", required: true },
      { key: "data", label: "Data", kind: "date", required: true },
      { key: "responsavel", label: "Responsável", kind: "text", required: true },
    ],
  },
];

export function getDocumentTemplate(key: string | null | undefined): DocumentTemplateDef | null {
  if (!key) return null;
  return DOCUMENT_TEMPLATES.find((t) => t.key === key) ?? null;
}

/** Campo único usado quando o documento é livre (sem modelo pedagógico). */
export const FREEFORM_BODY_FIELD: DocumentFieldDef = {
  key: "body",
  label: "Documento",
  kind: "richtext",
};

export function getFieldDefs(templateKey: string | null | undefined): DocumentFieldDef[] {
  const template = getDocumentTemplate(templateKey);
  return template ? template.fields : [FREEFORM_BODY_FIELD];
}
