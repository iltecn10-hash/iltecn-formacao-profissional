/** Padrões criados por escola na primeira necessidade (nunca sobrescrevem edição da escola). */

export const DEFAULT_SUBJECTS = [
  "Língua Portuguesa",
  "Matemática",
  "Ciências",
  "História",
  "Geografia",
  "Arte",
  "Educação Física",
  "Língua Inglesa",
  "Ensino Religioso",
  "Informática",
] as const;

export interface DefaultCriterion {
  code: string;
  label: string;
  kind: "level" | "yesno" | "text";
  options: { value: string; label: string }[];
  required: boolean;
}

/** Os 9 critérios iniciais do formulário do Conselho de Classe. */
export const DEFAULT_CRITERIA: DefaultCriterion[] = [
  {
    code: "rendimento",
    label: "Rendimento / Nota na disciplina",
    kind: "level",
    options: [
      { value: "acima", label: "Acima da média" },
      { value: "media", label: "Na média" },
      { value: "abaixo", label: "Abaixo da média" },
    ],
    required: true,
  },
  {
    code: "avanco",
    label: "Avanço",
    kind: "level",
    options: [
      { value: "grande", label: "Grande avanço" },
      { value: "esperado", label: "Dentro do esperado" },
      { value: "estagnado", label: "Estagnado" },
    ],
    required: true,
  },
  ...(
    [
      ["compreensao", "Compreensão de conceitos"],
      ["raciocinio", "Raciocínio e resolução de problemas"],
      ["tarefas", "Cumprimento de tarefas e entregas"],
      ["participacao", "Participação nas aulas"],
      ["convivencia", "Respeito e convivência"],
      ["assiduidade", "Assiduidade e pontualidade"],
    ] as const
  ).map(([code, label]) => ({
    code,
    label,
    kind: "yesno" as const,
    options: [
      { value: "sim", label: "Sim" },
      { value: "nao", label: "Não" },
    ],
    required: true,
  })),
  {
    code: "observacoes",
    label: "Observações pedagógicas",
    kind: "text",
    options: [],
    required: false,
  },
];

export const PERIOD_COUNT = 4;
export const periodName = (n: number) => `${n}º Bimestre`;
