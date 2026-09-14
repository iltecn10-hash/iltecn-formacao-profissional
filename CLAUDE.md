@AGENTS.md

# ILTECN — Formação Profissional

Plataforma educacional de simulação profissional: `APRENDER → PRATICAR → RESOLVER → AVALIAR → EVOLUIR`.
Empresa fictícia usada nas atividades práticas: **Supermercado Bom Preço**.

> Nota: este arquivo foi reconstruído a partir do código e do banco de dados reais em
> 2026-09-14. A especificação original de 59 seções mencionada no histórico do projeto
> não está versionada neste repositório (só existiam 2 commits, sem o documento de
> especificação). Este arquivo documenta o que **realmente existe** em produção, e deve
> ser mantido atualizado a cada nova fase.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + React 19
- Tailwind CSS v4
- PostgreSQL no Neon (projeto `iltecn-formacao-profissional`, id `little-water-81302783`), sem ORM (`pg` puro via `src/lib/db.ts`)
- Autenticação JWT própria (`jose`) em cookie httpOnly (`src/lib/auth.ts`), sem NextAuth
- Vitest + pg-mem para testes de integração sem depender de rede

## Onde está tudo

- GitHub: `iltecn10-hash/iltecn-formacao-profissional` (branch `main`)
- Deploy: Vercel — `https://iltecn-formacao-profissional.vercel.app`
- Banco: Neon, banco `iltecn`, branch `main` (`br-fancy-morning-axjthn7q`), região `us-east-2`

**Outros projetos Neon do usuário — nunca usar/alterar por engano:** `iltecn-os` (Ordens de Serviço), `iltecn-retrovisor` (monitoramento de preços) e `cobranca-automatizada`. Nenhum tem relação com este projeto.

## Estrutura de pastas

```
src/
  app/
    api/            — rotas REST (auth, schools, teachers, students, classes,
                       tracks, modules, missions, messages, supermarket/*,
                       reports, student-works)
    dashboard/       — páginas por perfil
    login/
  components/        — formulários/widgets client-side
  modules/           — camada de acesso a dados (SQL) por domínio
  lib/               — db.ts (pool pg), auth.ts (JWT/bcrypt), levels.ts
  types/index.ts     — tipos TS compartilhados
  proxy.ts           — middleware de proteção de rotas (Next 16 renomeou de middleware.ts)
tests/
  unit/              — regras de negócio isoladas + autorização de API (mock de sessão)
  integration/       — módulos de queries com pg-mem (Postgres em memória)
  setup/testDb.ts    — schema de teste reduzido para pg-mem
scripts/seed.ts       — cria admin + escola modelo
```

## Modelo de dados (produção — 32 tabelas)

Fundação: `users`, `schools`, `teachers`, `coordinators`, `students`, `classes`, `enrollments`
Formação/Missões: `tracks`, `modules`, `competencies`, `missions`, `mission_tasks`, `mission_competencies`, `mission_attempts`, `student_competencies`, `scores`
E-mail simulado: `internal_messages`
Supermercado: `categories`, `products`, `suppliers`, `customers`, `cash_registers`, `sales`, `sale_items`, `inventory_movements`, `accounts_payable`, `accounts_receivable`
Gamificação: `achievements`, `student_achievements`
**Laboratório de documentos/planilhas (Fase 9):** `student_works`, `student_work_versions`, `work_evaluations`, `work_comments`

## Autorização

Sempre verificada no backend (nunca só no frontend): `getSession()` lê e valida o JWT do
cookie `iltecn_session`; cada rota confere `session.role` explicitamente. Padrão usado em
toda rota:

```ts
const session = await getSession();
if (!session || session.role !== "papel_esperado") {
  return NextResponse.json({ error: "..." }, { status: 403 });
}
```

Para recursos "do próprio aluno" (relatório, trabalhos), o aluno só pode ver o que é seu
(compara `session.userId` → `getStudentIdByUserId` → `student_id` do recurso); demais perfis
(admin/professor/coordenador) podem ver qualquer aluno — não há hoje restrição por turma.

## Fluxo de missões (motor reaproveitado pela Fase 9)

`mission_attempts` guarda o progresso do aluno em cada missão
(`bloqueada/disponivel/em_andamento/concluida/refazer`). `completeMissionAttempt()` em
`src/modules/missions/queries.ts` é uma transação única que credita pontos, recalcula nível,
grava em `scores`, atualiza `student_competencies` e concede conquistas — é idempotente
(testado). Este é o "motor" de missão; novas funcionalidades devem reaproveitá-lo em vez de
duplicar a lógica.

## Fase 9 — Laboratório Prático de Documentos e Planilhas

Objetivo: o aluno cria/edita/salva/entrega documentos e planilhas **dentro da plataforma**,
sem depender de links externos (Word/Excel/Google Docs reais não são recriados — apenas o
necessário para as atividades profissionais previstas).

### 9.1 — Infraestrutura dos trabalhos do aluno (concluída em 2026-09-14)

- Tabelas novas (só `CREATE TABLE`, nenhuma alteração destrutiva nas 8 fases anteriores):
  `student_works` (um registro por aluno+missão+tipo de trabalho — permite DOCUMENT e
  SPREADSHEET na mesma missão), `student_work_versions` (snapshot preservado a cada
  entrega), `work_evaluations` (avaliação automática ou manual) e `work_comments`
  (comentários do professor).
- Módulo de queries: `src/modules/student-works/queries.ts` — `getOrCreateStudentWork`,
  `saveStudentWorkContent` (autosave, bloqueado após entrega), `submitStudentWork`
  (idempotente, versiona antes de trocar o status), `listStudentWorkVersions`,
  `listStudentWorksByStudent`, `listStudentWorksForStaff`.
- APIs (`src/app/api/student-works/**`): `POST/GET /api/student-works`,
  `GET/PATCH /api/student-works/[id]`, `POST /api/student-works/[id]/submit`,
  `GET /api/student-works/[id]/versions`. Autorização sempre no backend, seguindo o mesmo
  padrão das rotas existentes.
- `ensureMissionAttemptId` reaproveita o upsert de `mission_attempts` já usado por
  `startMissionAttempt` (não duplica a lógica de tentativa de missão).
- Testes: `tests/integration/student-works.test.ts` (criação, isolamento de propriedade,
  autosave, versionamento na entrega, idempotência) e
  `tests/unit/student-works-authorization.test.ts` (papel por rota). 19 testes novos, 40 no
  total, todos passando; `npm run build` e `npm run lint` sem erros.
- Correção incidental em `tests/setup/testDb.ts`: `gen_random_uuid()` precisava do flag
  `impure: true` no pg-mem — sem ele, o pg-mem faz *constant-folding* da função e repete o
  mesmo UUID quando a mesma instrução SQL roda mais de uma vez no mesmo teste. Não afeta
  nenhum teste anterior (nenhum deles repetia a mesma instrução), só corrige um bug latente
  na infraestrutura de testes compartilhada.
- Ainda **não implementado** (fases seguintes): editor de documentos (9.2), editor de
  planilhas (9.3), campos de `missions` para declarar tipo/template/regras de avaliação
  exigidos (9.4), fluxo de entrega ligado à avaliação automática (9.5), dashboard do
  professor "Trabalhos dos Alunos" (9.6).

### 9.2 — Editor de documentos (concluída em 2026-09-14)

- Dependência nova (avaliada antes de instalar — seção 31): Tiptap 2.27.3
  (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`,
  `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-table`
  + `table-row`/`table-cell`/`table-header`) — única versão da linha 2.x com suporte
  oficial a React 19, versões fixadas (sem `^`). **Vulnerabilidade conhecida:** o advisory
  GHSA-cp6q-959q-f8rh (`mergeAttributes()` tratando uma chave `__proto__` própria como
  atributo de DOM herdado/executável) cobre toda a série 2.x — só corrigido numa major
  (3.x) com API incompatível. Em vez de forçar essa migração agora, mitigado na fronteira
  de confiança: `src/lib/sanitize-json.ts` remove recursivamente chaves
  `__proto__`/`constructor`/`prototype` de todo conteúdo antes de gravar em
  `student_works.content` (usado em `saveStudentWorkContent`). Reavaliar quando o Tiptap 3
  estabilizar.
- Duas extensões Tiptap pequenas e caseiras em vez de mais dependências
  (`src/components/document-editor/extensions.ts`): `FontSize` (atributo em `textStyle`) e
  `Indent` (recuo básico de parágrafo/título, 0–8 níveis).
- Modelos pedagógicos (seção 5) em `src/lib/document-templates.ts`: memorando,
  requerimento, declaração, relatório, comunicado — cada um com campos estruturados
  (texto/data) e ao menos um campo richtext. Documento "livre" (sem modelo) usa um único
  campo richtext (`FREEFORM_BODY_FIELD`).
- Formato de `student_works.content` para `work_type = 'DOCUMENT'`:
  `{ fields: Record<string,string>, rich: Record<string, TiptapJSON> }` — ver
  `DocumentWorkContent` em `src/types/index.ts`. Não exigiu nenhuma migration nova: o
  `content JSONB` da 9.1 já comporta esse formato.
- UI: `/dashboard/trabalhos` ("Meus Trabalhos" — lista os trabalhos do aluno + formulário
  para criar um documento novo escolhendo missão e modelo) e
  `/dashboard/trabalhos/documento/[id]` (o editor). Autosave via `PATCH` com debounce de
  1.5s e indicador "Salvando…/Salvo/Erro ao salvar"; "Entregar documento" chama
  `POST .../submit` e trava a edição; botão "Imprimir/PDF" usa `window.print()` com CSS
  `@media print` dedicado (sem depender de biblioteca de geração de PDF — seção 7).
- A escolha de missão/modelo na criação do documento é manual e temporária: a partir da
  9.4, a própria missão vai declarar isso (`work_config`), e essa tela deixa de perguntar.
- Testes novos: `tests/unit/sanitize-json.test.ts` (remoção de `__proto__`/`constructor`/
  `prototype`, inclusive aninhado) e `tests/unit/document-templates.test.ts` (catálogo de
  modelos). 9 testes novos, 49 no total, todos passando; build e lint sem erros.
- Verificação manual (seção 36) feita direto na Vercel de produção: aluno fictício
  "Aluno Teste Fase9" criado pelo admin real, login, criação de um memorando, edição de
  campos + texto rico + tabela, autosave confirmado após reload, entrega, e confirmação de
  que a edição fica bloqueada depois de entregue.
- Ainda **não implementado**: editor de planilhas (9.3), integração real com o `work_type`
  da missão (9.4), avaliação (9.5), dashboard do professor (9.6).

### 9.3 — Editor de planilhas (concluída em 2026-09-14)

- Nenhuma dependência nova: em vez de uma biblioteca de planilha (avaliado e descartado
  por ir contra a seção 31 — "evitar dependências desnecessárias" — para uma grade simples
  de fórmulas básicas), o motor de fórmulas e a grade são implementação própria.
- Motor de fórmulas em `src/lib/spreadsheet-formulas.ts`: tokenizador + parser recursivo
  próprios (sem `eval`/`Function` em nenhum momento — o conteúdo vem do aluno e é tratado
  como dado não confiável, mesma postura da 9.2). Suporta os quatro operadores aritméticos
  com precedência e parênteses, referências de célula (`A1`), intervalos (`A1:B3`) e as
  funções `SOMA`/`SUM`, `MEDIA`/`AVERAGE`, `MAXIMO`/`MAX`, `MINIMO`/`MIN`,
  `CONTAR`/`CONT.VALORES`/`COUNT` (nomes em português e inglês). Detecta referência
  circular e divisão por zero sem travar (retorna célula `#ERRO` com mensagem). Intervalo
  vazio: `SOMA`/`CONTAR` resultam em 0 (como em planilhas reais); `MEDIA`/`MAXIMO`/`MINIMO`
  retornam erro (não há como tirar média/máximo de nada).
- Modelos pedagógicos em `src/lib/spreadsheet-templates.ts`: Fechamento de Caixa, Controle
  de Estoque, Contas a Pagar da Semana, Comparativo de Vendas por Vendedor — cada um com
  cabeçalhos e ao menos uma fórmula de exemplo já funcionando. Planilha "livre" usa uma
  grade em branco de 20×8 (`FREEFORM_GRID`).
- Formato de `student_works.content` para `work_type = 'SPREADSHEET'`:
  `{ rows: number, cols: number, cells: Record<string, string> }` — mapa esparso, só
  células preenchidas aparecem (ver `SpreadsheetWorkContent` em `src/types/index.ts`). Não
  exigiu nenhuma migration nova, pelo mesmo motivo da 9.2.
- UI: `src/components/spreadsheet-editor/spreadsheet-grid.tsx` (grade HTML editável, célula
  ativa vira `<input>` mostrando a fórmula bruta, célula inativa mostra o valor calculado;
  Enter desce uma linha, Tab avança uma coluna) e `spreadsheet-work-editor.tsx`
  (título, autosave com o mesmo debounce de 1.5s da 9.2, botões "+ Linha"/"+ Coluna" com
  limite de 60×20, "Entregar planilha" trava a edição, "Imprimir/PDF" via `window.print()`).
  `/dashboard/trabalhos` ganhou um segundo formulário lateral ("Nova planilha") ao lado do
  de documento, e a listagem de trabalhos agora abre documento ou planilha conforme
  `work_type`.
- Reaproveita 100% da infraestrutura da 9.1 (mesmas APIs REST, mesmo
  `saveStudentWorkContent`/`submitStudentWork`/`sanitizeJsonValue`) — nenhuma rota nova.
- Testes novos: `tests/unit/spreadsheet-formulas.test.ts` (aritmética, referências,
  intervalos, funções, erros de divisão por zero e referência circular, formatação) e
  `tests/unit/spreadsheet-templates.test.ts` (catálogo de modelos, fórmulas de exemplo
  avaliando sem erro). 21 testes novos, 70 no total, todos passando; `npm run lint` sem
  erros; `npm run build` limpo (precisa de `DATABASE_URL` definida no ambiente — mesmo em
  um valor fictício — porque o `pg.Pool` é criado no import do módulo `db.ts`; não conecta
  de fato nesse momento, só na primeira query).
- Ainda **não implementado**: integração real com `work_type`/modelo declarado pela missão
  (9.4 — a escolha manual de missão/modelo nos dois formulários é temporária), avaliação
  automática do conteúdo (9.5), dashboard do professor (9.6). Verificação manual em
  produção (seção 36) ainda **pendente** para esta subfase — só a criação de documento foi
  testada ao vivo até agora.

### Próximas subfases

9.4 Integração com missões (campo de configuração em `missions`, ex. `work_config JSONB`,
substituindo a escolha manual de missão/modelo da 9.2/9.3) → 9.5 Entrega e avaliação → 9.6
Integração com professor → 9.7 Testes e refinamento. Cada uma só deve avançar depois da
anterior estar validada (testes + build passando).

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm test         # vitest run (unit + integration, sem rede)
npm run lint     # eslint
npm run seed     # cria admin + escola modelo (precisa de DATABASE_URL)
```

## Decisões técnicas e aprendizados importantes

- **Neon MCP `run_sql_transaction`** executa statements sequencialmente, não é uma
  transação SQL real. Para mudanças de schema, usar `prepare_database_migration` (testa em
  branch temporária) + `complete_database_migration` (nunca autônomo — sempre confirmar com
  o usuário antes).
- **Fontes:** Google Fonts não funciona no sandbox de execução — o projeto usa fontes de
  sistema via CSS puro.
- **Next.js 16:** `middleware.ts` foi renomeado para `proxy.ts` (export `proxy`).
- **Vercel:** `.npmrc` com `legacy-peer-deps=true` é necessário (conflito de peer dependency
  entre `vitest` e `@types/node`).
- **pg-mem (testes):** não suporta `WITH ... INSERT`; precisa de cast explícito em
  `UPDATE ... SET col = col ± $1` (`$1::int`); subqueries correlacionadas aninhadas duas
  camadas às vezes falham (preferir `LEFT JOIN`); funções registradas que devem gerar valor
  novo a cada chamada (como `gen_random_uuid`) precisam de `impure: true`, senão o resultado
  é constant-folded entre execuções da mesma instrução SQL.
