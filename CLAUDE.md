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
- Verificação manual (seção 36) feita direto na Vercel de produção: criação de uma planilha
  "Fechamento de Caixa" pelo aluno de teste, edição de células literais e de fórmulas
  (`=SOMA(...)`, referência entre células, divisão por zero mostrando `#ERRO` em vermelho),
  recálculo automático confirmado, "+ Linha"/"+ Coluna", autosave confirmado após reload,
  entrega, e confirmação de que a edição fica bloqueada depois de entregue.
- Observação de código encontrada durante o teste (não chega a ser um bug alcançável pelo
  usuário real): `addRow`/`addColumn` em `spreadsheet-work-editor.tsx` calculam o próximo
  estado a partir da variável `content` capturada no fechamento do componente. Disparar as
  duas funções na mesma revalidação do React (só possível programaticamente, ex. dois
  `.click()` seguidos sem aguardar o re-render) faz uma sobrescrever a outra. Cliques reais
  do usuário sempre têm um ciclo de renderização entre eles, então não reproduz na prática;
  mesmo assim, o ideal seria trocar para a forma funcional do `setState`
  (`setContent(prev => ({ ...prev, rows: prev.rows + 1 }))`) na 9.7 (testes e refinamento).
- Ainda **não implementado**: integração real com `work_type`/modelo declarado pela missão
  (9.4 — a escolha manual de missão/modelo nos dois formulários é temporária), avaliação
  automática do conteúdo (9.5), dashboard do professor (9.6).

### 9.4 — Integração com missões (concluída em 2026-09-14)

- Migration aditiva em produção (Neon, sem perda/alteração de dados existentes):
  `ALTER TABLE missions ADD COLUMN work_config JSONB DEFAULT NULL` (id da migration
  `78749234-3b77-480a-a593-935e57b07ccb`, testada antes numa branch temporária via
  `prepare_database_migration`/`complete_database_migration`, só aplicada após confirmação
  explícita do usuário). `MissionWorkConfig = { workType: 'DOCUMENT'|'SPREADSHEET',
  templateKey: string|null }` (ver `src/types/index.ts`); `work_config = null` significa
  "esta missão não tem trabalho associado". Populados 9 das 14 missões existentes com o
  tipo/modelo correspondente (ex. "Memorando: Mudança no Horário de Almoço" →
  `{workType:"DOCUMENT",templateKey:"memorando"}`, "Fechamento de Caixa do Dia" →
  `{workType:"SPREADSHEET",templateKey:"fechamento_caixa"}`); as outras 5 (Backup em
  Pendrive, Pesquisa de Fornecedores, Primeira Venda no Caixa, Organização da Pasta de
  Trabalho e uma missão com título incompleto) ficaram com `work_config = NULL` de
  propósito, por não terem um documento/planilha correspondente óbvio.
- `listMissionsByModule` e a subquery de missões de `getStudentProgress`
  (`src/modules/missions/queries.ts`) passaram a selecionar `work_config`; `Mission` em
  `src/types/index.ts` ganhou o campo `work_config: MissionWorkConfig | null`.
- `MissionCard` (`src/components/mission-card.tsx`) ganhou o botão "Abrir documento/planilha
  da missão" quando `workConfig` não é nulo e a missão não está bloqueada: chama
  `POST /api/student-works` com `missionId`/`workType`/`templateKey` da própria missão (sem
  perguntar nada ao aluno) e navega para o editor — reaproveita 100% o
  `getOrCreateStudentWork` idempotente da 9.1, nenhuma API nova.
- `/dashboard/trabalhos` ("Meus Trabalhos") deixou de ter os formulários "Novo
  documento"/"Nova planilha" com escolha manual de missão/modelo (eram temporários desde a
  9.2/9.3) e virou uma página só de listagem, com um aviso apontando para "Missões" como
  o lugar onde os trabalhos são criados. Removidos por não terem mais uso:
  `src/components/student-works/new-document-form.tsx`,
  `src/components/student-works/new-spreadsheet-form.tsx` e a função
  `listMissionsForNewWork` em `src/modules/student-works/queries.ts`.
- Testes: `tests/integration/mission-work-config.test.ts` (novo) — confirma que
  `listMissionsByModule` devolve `work_config` como objeto (não como string JSON crua) e
  como `null` quando a missão não declara. `tests/setup/testDb.ts` precisou ser expandido
  (schema de `tracks`/`modules`/`missions` estava desatualizado em relação à produção —
  faltavam colunas como `active`, `description`, `sort_order`, `context`, `objective`,
  entre outras, verificado via `describe_table_schema`). Não foi possível testar
  `getStudentProgress` com a nova coluna em pg-mem: a query combina `LEFT JOIN
  mission_attempts` com uma subquery correlacionada (`array_agg` de competências) que o
  pg-mem não resolve (`column "m.id" does not exist`), limitação já documentada abaixo em
  "Decisões técnicas" — a query já roda normalmente em produção (Postgres real) e é
  anterior à 9.4; a cobertura da coluna nova ficou com `listMissionsByModule`, que usa a
  mesma coluna sem essa combinação problemática. 71 testes no total (70 da 9.3 + 1 novo,
  já que um segundo teste planejado para `getStudentProgress` não pôde rodar em pg-mem);
  `npm run lint` e `npm run build` (com `DATABASE_URL` fictícia) sem erros.
- Ainda **não implementado**: avaliação automática/manual do conteúdo do trabalho (9.5),
  dashboard do professor "Trabalhos dos Alunos" (9.6).

### 9.5 — Entrega e avaliação (concluída em 2026-09-14)

- Nenhuma migration nova: a tabela `work_evaluations` já existia desde a 9.1
  (`evaluator_id`, `evaluation_type`, `score`, `passed`, `feedback`, `details`), só ainda
  não era usada. A entrega (`submitStudentWork`) passou a gravar, na mesma transação que
  trava o trabalho, uma avaliação automática (`evaluation_type = 'AUTO'`, `evaluator_id =
  NULL`) — calculada uma única vez, sobre o conteúdo que acabou de ser travado, e nunca
  recalculada depois (mesmo que a régua de avaliação mude no futuro).
- Motor de avaliação em `src/lib/work-evaluation.ts` — deliberadamente sobre
  **completude/estrutura**, não qualidade de redação:
  - **Documento:** usa os mesmos `fieldDefs` do modelo (seção 5, `document-templates.ts`);
    conta como preenchido um campo de texto/data não vazio (`.trim()`) ou um campo richtext
    com pelo menos um nó de texto real no JSON do Tiptap (parágrafo vazio não conta). Um
    campo sem `required` explícito conta como obrigatório para avaliação — cobre o
    documento livre, cujo único campo (`FREEFORM_BODY_FIELD`) não declara `required` por
    não ter modelo pedagógico. `score` = % de campos obrigatórios preenchidos; `passed` =
    todos preenchidos.
  - **Planilha:** compara `content.cells` com o esqueleto do modelo (`spreadsheet-
    templates.ts`) para contar só as células que o aluno preencheu/alterou (dados
    próprios, não cabeçalho); reaproveita `evaluateGrid()` da 9.3 para achar fórmulas com
    erro. `passed` exige pelo menos 3 células de dados do aluno **e** nenhuma fórmula com
    `#ERRO`. Planilha livre (sem modelo) conta toda célula preenchida como dado do aluno,
    já que não há esqueleto para descontar.
  - Para os dois tipos, a função sempre retorna um resultado (nunca `null`) — a régua muda
    conforme o tipo/modelo, mas há sempre algo objetivo pra medir, mesmo em trabalho livre.
- Nova API: `GET /api/student-works/[id]/evaluations` (mesmo padrão de autorização de
  `/versions`: o próprio aluno dono ou qualquer perfil de equipe) — lista as avaliações do
  trabalho, mais recente primeiro. A Fase 9.6 vai inserir avaliações `MANUAL` na mesma
  tabela/rota, sem mudar esse contrato.
- UI: `src/components/work-evaluation-panel.tsx` (novo, compartilhado pelos dois editores)
  busca essa rota e mostra nota/aprovação/feedback assim que o trabalho é travado —
  aparece nos dois editores (`document-work-editor.tsx`, `spreadsheet-work-editor.tsx`)
  logo abaixo do aviso "já foi entregue".
- Testes novos: `tests/unit/work-evaluation.test.ts` (motor de avaliação isolado — memorando
  com campos faltando/completos, espaço em branco não conta como preenchido, documento e
  planilha livres, planilha com fórmula em erro) e
  `tests/integration/work-evaluation-submit.test.ts` (via pg-mem: `submitStudentWork` grava
  a avaliação AUTO corretamente e não duplica em entregas repetidas). 11 testes novos, 82
  no total, todos passando; `npm run lint` e `npm run build` sem erros.
- Ainda **não implementado**: avaliação **manual** do professor (registro `MANUAL` na
  mesma tabela, com `evaluator_id` preenchido) e o dashboard "Trabalhos dos Alunos" para
  ele acessar/comentar/avaliar (9.6).

### 9.6 — Integração com professor (concluída em 2026-09-14)

- Nenhuma migration nova: `work_evaluations` (avaliação `MANUAL`) e `work_comments` já
  existiam desde a 9.1, só ainda não eram usadas.
- `src/modules/student-works/queries.ts` ganhou:
  - `listWorkComments` / `addWorkComment` — comentários de um trabalho, com o nome do
    autor via join em `users`; sem regra de papel na query (a autorização fica na rota).
  - `recordManualEvaluation(workId, evaluatorId, { passed, score?, feedback? })` — grava
    uma avaliação `MANUAL` e **sempre** decide o destino do trabalho: `passed: true` →
    `APPROVED`; `passed: false` → `RETURNED`. Guard: só avalia um trabalho com
    `submitted_at` preenchido (`WorkNotSubmittedError` caso contrário). Como `RETURNED`
    nunca esteve em `LOCKED_STATUSES` (decisão da 9.1), devolver o trabalho já o reabre
    para edição do aluno automaticamente — nenhuma lógica nova precisou disso.
- Novas rotas:
  - `GET/POST /api/student-works/[id]/comments` — mesmo padrão de autorização de
    `/evaluations` (aluno dono ou qualquer perfil de equipe); `POST` valida `body` não
    vazio (máx. 2000 caracteres) com Zod.
  - `POST /api/student-works/[id]/evaluate` — só `admin`/`teacher`/`coordinator`; Zod
    valida `{ passed: boolean; score?: 0-100; feedback?: string }`; `WorkNotSubmittedError`
    vira HTTP 409.
- UI:
  - `work-evaluation-panel.tsx` foi separado em `EvaluationList` (renderização pura,
    recebe `evaluations` prontas) + `WorkEvaluationPanel` (busca e usa `EvaluationList`).
    A página de staff acaba mostrando a mesma lista de novo através do próprio editor em
    modo `readOnly` (que já embute `WorkEvaluationPanel`); `EvaluationList` fica disponível
    para uma futura tela que busque os dados no servidor sem esse fetch extra no cliente.
  - `work-comments-thread.tsx` (novo) — lista comentários e formulário de novo comentário;
    usado sem alteração no editor do aluno e na página de staff (a autoria vem da sessão
    no servidor).
  - `manual-evaluation-form.tsx` (novo, só na página de staff) — nota opcional (0-100),
    feedback opcional, botões "Aprovar" / "Devolver para revisão"; usa `router.refresh()`
    após enviar em vez de estado local, já que o status/avaliação são recarregados do
    servidor.
  - `document-work-editor.tsx` e `spreadsheet-work-editor.tsx` ganharam uma prop opcional
    `readOnly` (usada pela página de staff: sempre trava o editor, independente do
    status) e trocaram o gate de `isLocked` para um novo `hasSubmission` (`readOnly ||
    status ∈ {SUBMITTED, APPROVED, RETURNED}`) ao mostrar `WorkEvaluationPanel` e o novo
    `WorkCommentsThread`. **Isso corrige um bug da 9.5**: o gate antigo (`isLocked`, que
    exclui `RETURNED`) escondia a avaliação e o feedback exatamente quando o aluno mais
    precisava vê-los — no trabalho devolvido. Também ganharam um aviso específico para
    `RETURNED` ("foi devolvido pelo professor...") e o botão de entrega passa a dizer
    "Entregar novamente" nesse estado.
- Nova página `src/app/dashboard/trabalhos-alunos/page.tsx` (`admin`/`teacher`/
  `coordinator`) — lista + detalhe em uma página só (mesmo padrão de
  `/dashboard/relatorio`, seleção via `?workId=`), reaproveitando
  `listStudentWorksForStaff` (já existia desde a 9.1) e os editores em modo `readOnly`
  para mostrar o trabalho; `ManualEvaluationForm` só aparece quando `submitted_at` está
  setado. Item de menu "Trabalhos dos Alunos" adicionado em `sidebar-nav.tsx` para os
  mesmos três papéis.
- Testes novos: `tests/integration/work-professor-review.test.ts` (via pg-mem) — lista
  comentários em ordem cronológica com nome do autor; recusa avaliar trabalho nunca
  entregue; aprovar muda status para `APPROVED`; devolver muda para `RETURNED`; aluno
  entrega de novo depois de devolvido gera nova versão e nova avaliação `AUTO` (agora há
  2 avaliações `AUTO` no histórico, uma por entrega). 5 testes novos, 87 no total, todos
  passando; `npm run lint`, `tsc --noEmit` e `npm run build` sem erros.
- **Dois bugs encontrados na verificação ao vivo em produção (corrigidos no mesmo dia,
  antes de fechar a subfase):** em ambos os casos o sintoma era o mesmo — a avaliação
  nova não aparecia na tela, só depois de um reload manual — mas com causas e correções
  diferentes por serem componentes/fluxos distintos:
  1. **Lado do professor:** `ManualEvaluationForm` chamava `router.refresh()` após
     aprovar/devolver, mas `WorkEvaluationPanel` é um client component que busca as
     avaliações uma única vez no mount e só reage a mudança de `workId` (que não muda
     aqui) — `router.refresh()` atualiza o Server Component, não remonta esse painel.
     Corrigido trocando por `window.location.reload()` no formulário (aceitável nessa
     tela, que não tem estado de edição em andamento para perder).
  2. **Lado do aluno:** reentregar um trabalho `RETURNED` (que já mostra os painéis de
     avaliação/comentários desde a correção do bug da 9.5) tem o mesmo problema: os
     painéis já estavam montados antes da reentrega, então `RETURNED → SUBMITTED` não
     disparava um novo fetch. Aqui um reload de página seria mais invasivo (o aluno está
     no meio da edição), então a correção foi `key={status}` em `WorkEvaluationPanel` e
     `WorkCommentsThread` dentro dos dois editores — ao mudar o status, o React
     desmonta/remonta os painéis, refazendo o fetch automaticamente.
  - Aprendizado para próximas subfases: qualquer client component que busca dados uma
    vez no mount e é reaproveitado num fluxo onde o status/conteúdo muda por baixo dele
    (sem trocar de página) precisa de uma estratégia explícita de refetch — `key` quando
    dá para remontar sem custo, reload completo quando não há estado a preservar.
- **Observação não bloqueante encontrada ao validar a correção do item 2 acima:** logo
  após o aluno reentregar um trabalho `RETURNED` (transição de status via `key`), a tela
  mostrou por alguns instantes as avaliações **duplicadas** (cada uma renderizada duas
  vezes) — confirmado no banco (`work_evaluations`) que os dados estavam corretos o
  tempo todo, sem nenhuma linha duplicada; um reload completo da página já mostra a
  lista certa, uma vez cada. Aparenta ser um artefato transitório do
  desmonte/remonte via `key` coincidindo com o `router.refresh()` do próprio
  `handleSubmitWork` (duas atualizações da árvore quase simultâneas). Não bloqueia a
  9.6 — o dado nunca esteve errado, só a tela durante uma janela curta — mas vale
  investigar na 9.7 se compensa trocar a estratégia de refetch por algo que não dependa
  de remontar o componente (ex.: um contador de versão em estado do componente pai,
  incrementado explicitamente após o submit, passado como prop em vez de `key`).

### Próximas subfases

9.7 Testes e refinamento (última subfase da Fase 9) — inclui revisitar: (1) a observação
não bloqueante de closure obsoleto em `addRow`/`addColumn` do
`spreadsheet-work-editor.tsx` já registrada no relatório da 9.3; (2) a duplicação visual
transitória pós-reentrega registrada acima, na 9.6.

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
