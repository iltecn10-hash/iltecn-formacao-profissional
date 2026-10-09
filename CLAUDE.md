@AGENTS.md

# ILTECN — Formação Profissional

> **Nome exibido da plataforma (desde 2026-10-08): "ILTECN — Plataforma de Alfabetização Digital"** (título da página, login, menu lateral, validação e certificados). Só texto de interface: repositório, projeto Vercel/Neon, banco e nomes dos programas ("Formação Profissional", "ILTECN LAB — Primeiros Passos no Computador") não mudaram.

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

## Modelo de dados (produção — 33 tabelas; +3 do ILTECN LAB após a migration da Fase 11)

Fundação: `users`, `schools`, `teachers`, `coordinators`, `students`, `classes`, `enrollments`
Formação/Missões: `tracks`, `modules`, `competencies`, `missions`, `mission_tasks`, `mission_competencies`, `mission_attempts`, `student_competencies`, `scores`
**Vídeos didáticos por etapa (Fase 10):** `mission_task_videos`
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

### 9.7 — Testes e refinamento (concluída em 2026-09-15)

Última subfase da Fase 9 — não adicionou funcionalidade nova, só corrigiu as duas
observações não bloqueantes deixadas pendentes nas subfases anteriores. Nenhuma
migration, rota ou schema mudou.

- **Causa raiz da duplicação visual transitória (9.6) corrigida.** O problema era a
  estratégia de refetch em si (`key={status}` forçando desmonte/remonte de
  `WorkEvaluationPanel`/`WorkCommentsThread`), não um bug de dados — o remonte podia
  coincidir com o `router.refresh()` do próprio `handleSubmitWork` e deixar o componente
  antigo e o novo coexistindo por um instante. Trocado por uma prop `refreshKey?: string |
  number`, incluída no array de dependências do `useEffect` de busca já existente
  (`[workId, refreshKey]`) nos dois componentes — o mesmo componente refaz o fetch quando
  o valor muda, sem nunca desmontar. Os dois editores (`document-work-editor.tsx`,
  `spreadsheet-work-editor.tsx`) agora passam `refreshKey={status}` no lugar de
  `key={status}`.
- **Efeito colateral (bônus) dessa mudança:** para isso funcionar em modo `readOnly`
  (tela de staff) sem remontar nada, o `status` interno do editor precisava refletir
  sempre a prop `work.status` mais recente vinda do servidor — antes era um único
  `useState(work.status)` congelado no valor inicial. Agora cada editor tem
  `localStatus` (estado otimista, só usado no editor do próprio aluno, atualizado
  imediatamente após `handleSubmitWork`) e deriva `status = readOnly ? work.status :
  localStatus`. Com isso, o `window.location.reload()` do `ManualEvaluationForm`
  (workaround do bug 1 da 9.6) deixou de ser necessário: voltou a ser `router.refresh()`
  simples — atualiza `work` no Server Component, o novo `status` desce como prop, e os
  painéis refazem a busca sozinhos via `refreshKey`.
- **Closure obsoleto em `addRow`/`addColumn` corrigido** (observação já registrada no
  relatório da 9.3): as duas funções, junto com `updateCell` no editor de planilha e
  `updateFieldValue`/`updateRichValue` no editor de documento, agora usam a forma
  funcional do `setState` (`setContent(prev => ({ ...prev, ... }))`) em vez de calcular
  o próximo valor a partir da variável `content` capturada no fechamento da função. O
  disparo do autosave também saiu de dentro de cada função mutadora e virou um único
  `useEffect` que observa `content` e chama `scheduleSave(title, content)` sempre que
  muda (pulando a primeira renderização com um ref `isFirstContentRender`), garantindo
  que o autosave sempre usa o estado realmente commitado mais recente.
- Nenhum teste novo foi necessário — é um refinamento interno de como o estado já
  testado se propaga, não uma regra de negócio nova; a suíte de 87 testes (14 arquivos)
  continua cobrindo o comportamento observável e passou sem alteração. Verificação:
  `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (87/87) e `npm run build`, todos
  sem erros; e verificação ao vivo em produção confirmando que a duplicação não ocorre
  mais e que os fluxos de avaliação/comentários (professor e aluno) continuam
  atualizando a tela sem reload manual.

### Próximas subfases

Fase 9 (Laboratório Prático de Documentos e Planilhas) concluída com a 9.7 — todas as
sete subfases (9.1 a 9.7) entregues, testadas e verificadas em produção.

## Fase 10 — Vídeos Didáticos nas Missões

Aditivo do usuário: cada etapa de uma missão pode ter um vídeo curto explicando a
tarefa, seguindo o fluxo pedagógico "LER → ASSISTIR → PRATICAR → CONCLUIR". O vídeo é um
recurso opcional (nunca obrigatório para concluir a missão) que complementa o manual, não
o substitui.

### 10.1 — Infraestrutura de vídeo (concluída em 2026-09-15)

Antes de implementar, foi feito o levantamento pedido pelo próprio aditivo (analisar
estrutura atual, verificar `resource_url`, verificar armazenamento de missão, evitar
duplicação). Achado principal: `missions.resource_url` é um link único por missão
inteira (não por etapa) e `mission_tasks` (id, mission_id, description, sort_order) já
existe no banco desde o início do projeto, mas **nunca foi lida em lugar nenhum da
interface** — só era gravada na criação da missão (textarea "Tarefas" do
`mission-form.tsx`) e nunca exibida a nenhum aluno. Ou seja, "etapa" ainda não era um
conceito visível; a missão era (e continua sendo, até a 10.2) um cartão único.

Escopo desta subfase, deliberadamente mínimo (item 17 do aditivo — "criar a menor
estrutura necessária"): só a infraestrutura de dados e API, sem nenhuma tela nova. A
tela do aluno (exibir as etapas + player) fica para a 10.2; o formulário do professor
para gerenciar vídeos fica para a 10.3.

- Nova tabela `mission_task_videos` (metadados apenas — item 9 do aditivo, nada de
  arquivo de vídeo no Postgres): `mission_task_id` (FK única — só um vídeo por etapa por
  vez; "trocar vídeo" no item 8 já indica substituição, não acúmulo), `title`,
  `description`, `video_url`, `thumbnail_url`, `duration_seconds`, `provider`
  (`YOUTUBE`/`VIMEO`/`CLOUD_STORAGE`/`INTERNAL`, CHECK constraint, default `YOUTUBE` —
  arquitetura multi-provedor do item 10, mas só `YOUTUBE` terá player embutido na 10.2),
  `video_type` (`EXPLICATIVO`/`DEMONSTRATIVO`/`EXEMPLO`/`ORIENTACAO`, CHECK constraint,
  default `DEMONSTRATIVO` — taxonomia do item 3), `active`.
- `src/modules/missions/queries.ts` ganhou `getMissionTaskById`,
  `listMissionTasksWithVideo(missionId)` (etapas + vídeo associado, com `video: null`
  quando não houver — duas consultas simples em vez de JOIN com agregação em JSON, para
  não depender de função do Postgres que precisaria ser replicada no pg-mem dos testes),
  `upsertMissionTaskVideo` (insere ou substitui via `ON CONFLICT (mission_task_id)`) e
  `deleteMissionTaskVideo`.
- Novas rotas: `GET /api/missions/[id]/tasks` (lista etapas + vídeo; qualquer usuário
  autenticado — não é dado sensível, e tanto aluno quanto equipe vão precisar ler);
  `PUT`/`DELETE /api/missions/[id]/tasks/[taskId]/video` (só
  admin/professor/coordenador; confere que a etapa pertence mesmo à missão da URL antes
  de gravar, devolvendo 404 caso contrário).
- `tests/setup/testDb.ts` (pg-mem) ganhou `mission_tasks` — que já existia em produção
  mas nunca tinha sido adicionada ao banco de teste em memória, então nenhuma consulta
  que a envolvesse era testável antes — e `mission_task_videos`. 10 testes novos (97 no
  total): consultas em `tests/integration/mission-task-videos.test.ts` (listar com/sem
  vídeo, upsert cria e depois substitui em vez de duplicar, delete volta a `null`,
  `getMissionTaskById` inexistente devolve `null`) e autorização das novas rotas em
  `tests/unit/api-authorization.test.ts` (aluno barrado com 403, equipe autorizada,
  etapa de outra missão devolve 404). `npx tsc --noEmit`, `npm run lint`,
  `npx vitest run` (97/97) e `npm run build` sem erros.
- Nada da Fase 9 foi alterado; `resource_url` e `work_config` continuam funcionando como
  antes.

### 10.2 — Tela do aluno: etapas + player (concluída em 2026-09-15)

Primeira vez que `mission_tasks` aparece na interface do aluno — reaproveita
`listMissionTasksWithVideo` da 10.1 sem nenhuma migration nova.

- `getStudentProgress` (`src/modules/missions/queries.ts`) passou a buscar as etapas de
  cada missão (`listMissionTasksWithVideo`) dentro do mesmo laço que já monta trilha →
  módulo → missão; `MissionWithProgress` ganhou o campo `tasks`. Mesmo estilo (uma
  consulta por item, não otimizado mas consistente) já usado no resto da função.
- Novo componente `mission-step-row.tsx`: uma etapa numerada, com o vídeo (se houver e
  estiver `active`) mostrando duração, uma etiqueta do tipo (Explicativo/Demonstrativo/
  Exemplo/Orientação — item 3 do aditivo) e o botão "▶ Assistir vídeo" que expande um
  player embutido em `<iframe>` inline; depois da primeira abertura o botão passa a
  dizer "↻ Assistir novamente" (item 6). Nunca bloqueia a missão (item 4) — é
  informativo, sem gate nenhum. `src/lib/youtube.ts` (novo) extrai o ID do vídeo de
  qualquer formato comum de URL do YouTube (`watch?v=`, `youtu.be/`, `/embed/`,
  `/shorts/`) e monta a URL de embed; providers que não sejam `YOUTUBE` caem para um
  link "assistir" simples em nova aba, sem player — arquitetura pronta para os outros
  provedores do item 10, mas só YouTube tem player nesta subfase (decisão do usuário).
- `mission-card.tsx` ganhou a seção "Etapas da missão" (só aparece quando a missão tem
  etapas cadastradas) e `missoes/page.tsx` passou a repassar `mission.tasks`.
- Sem tracking de progresso do vídeo (%, quantidade de visualizações — itens 6/7) nem
  manual/dicas/checklist ricos por etapa (itens 5/15): fica para depois da Fase 10.4, se
  o usuário quiser, em cima desta base.
- 12 testes novos (109 no total): `tests/unit/youtube.test.ts` cobre as variações de URL
  do YouTube (com/sem `www`/`m.`, `youtu.be`, `/embed/`, `/shorts/`, parâmetros extras,
  URL de outro provedor, string inválida). `npx tsc --noEmit`, `npm run lint`,
  `npx vitest run` (109/109) e `npm run build` sem erros. Sem migration nova.
- Vídeo de teste inserido diretamente no banco de produção (sem UI ainda — o formulário
  do professor é a 10.3) na etapa "Organizar os dados" da missão piloto "Relatório de
  Vendas do Mês", só para a verificação ao vivo desta subfase; será substituído por
  conteúdo real na 10.4.

### 10.3 — CRUD do professor/admin (concluída em 2026-09-15)

Reaproveita 100% da infraestrutura da 10.1 (rotas `PUT`/`DELETE
/api/missions/[id]/tasks/[taskId]/video`, já autorizadas para
admin/professor/coordenador) e da consulta `listMissionTasksWithVideo` da 10.1/10.2 —
nenhuma rota nova, nenhuma migration.

- Novo `src/components/mission-task-video-form.tsx` com três componentes: o exportado
  `MissionVideosPanel({ missionId, tasks })` (painel colapsável "Gerenciar vídeos das
  etapas" — não aparece se a missão não tem etapas), `MissionTaskVideoRow` (uma linha
  por etapa com status "Sem vídeo"/"Vídeo ativo"/"Vídeo desativado" e o botão
  Adicionar/Editar) e `MissionTaskVideoForm` (formulário único que serve para criar,
  editar e trocar o vídeo — é sempre um `PUT`/upsert, com botão "Remover vídeo" quando
  já existe um). Segue a mesma convenção de estilo (`inputClass`) dos demais formulários
  da equipe (`module-form.tsx` etc.).
- `src/app/dashboard/formacao/page.tsx` passou a buscar `listMissionTasksWithVideo` para
  cada missão junto com `listMissionsByModule` (mesmo padrão já usado em
  `getStudentProgress`) e a renderizar `<MissionVideosPanel>` dentro do item de cada
  missão em "Estrutura atual" — a listagem em si (título + pontos) não mudou.
- Nota de escopo: a tela "Formação" é `admin`-only (`session.role !== "admin"` no topo
  da página). As rotas de vídeo já autorizam `teacher`/`coordinator` desde a 10.1, mas
  hoje só o admin tem uma tela para usá-las — se professor/coordenador precisarem
  gerenciar vídeos diretamente, é preciso decidir uma página própria para esses papéis
  (não construída nesta subfase, para não expandir escopo sem pedido explícito).
- Sem testes novos: é um componente client puro sobre rotas já cobertas em
  `tests/unit/api-authorization.test.ts` (10.1) — segue a convenção do projeto de não
  testar unitariamente formulários client, só as rotas por trás deles. `npx tsc
  --noEmit`, `npm run lint`, `npx vitest run` (109/109, sem novos) e `npm run build` sem
  erros.
- Nada da Fase 9 nem das subfases 10.1/10.2 foi alterado.

### 10.4 — Vídeos piloto na missão "Relatório de Vendas do Mês" (concluída em 2026-09-15)

Primeira aplicação real da arquitetura multi-provedor do item 10 do aditivo: os 7
vídeos desta subfase usam `provider = 'INTERNAL'` (arquivo servido pelo próprio
Next.js, em vez de YouTube), sem nenhuma mudança de schema ou de código — só dados,
provando que a decisão de suportar vários provedores desde a 10.1 não era over
engineering.

- **Por que "INTERNAL" e não "YOUTUBE"**: o usuário pediu para o Claude Code produzir
  os 7 vídeos, mas não havia orçamento de créditos de geração de vídeo por IA (a conta
  tinha 68 créditos; um único vídeo de 30s custaria ~195) nem uma forma de publicar no
  canal do YouTube da ILTECN a partir do sandbox. Optou-se então por uma versão
  "piloto"/simples: slides estáticos (Pillow) + narração em voz sintetizada offline
  (`espeak-ng` com voz `mb-br4`, sem custo e sem dependência de rede) + montagem em
  vídeo (`ffmpeg`), tudo gerado localmente. Os 7 arquivos `.mp4` (1280×720, ~25-34s,
  ~400-500 KB cada) ficam versionados em `public/videos/relatorio-vendas-do-mes/` e
  são servidos como arquivo estático do próprio Next.js — daí `provider: 'INTERNAL'`.
  Como `MissionStepRow` só usa `<iframe>` para `provider === 'YOUTUBE'`, esses vídeos
  aparecem como link "▶ Assistir vídeo" que abre o `.mp4` direto no navegador (o
  player nativo do navegador toca normalmente), sem player embutido — mesmo
  comportamento já usado por qualquer provedor fora do YouTube desde a 10.2.
- **Roteiro de cada etapa**: como a missão só tinha título/contexto/objetivo gerais e
  uma descrição de uma linha por etapa (não existe "Manual Guiado" rico por etapa —
  isso é trabalho futuro, itens 5/15 do aditivo), o roteiro (objetivo, como fazer,
  exemplo, dica) de cada um dos 7 vídeos foi escrito pelo Claude Code com base no
  título da missão e na descrição de cada etapa.
- **Etapa 5 ("Criar gráfico") tratada à parte**: o editor de planilha do ILTECN não
  tem nenhum recurso de gráfico (só células com fórmulas como `=SOMA`/`=MEDIA`). Em
  vez de fingir um botão que não existe, o vídeo desta etapa é `EXPLICATIVO` e
  conceitual: explica para que serve um gráfico de vendas e como o Excel/Google Sheets
  fazem isso, deixando claro que o simulador ainda não tem essa ferramenta.
- Vídeo de teste da 10.2 (na etapa "Organizar os dados") substituído pelo vídeo
  definitivo desta subfase via `ON CONFLICT (mission_task_id) DO UPDATE` (mesma
  função `upsertMissionTaskVideo` da 10.1) — sem exigir nenhuma tela nova, o CRUD da
  10.3 já teria dado conta se fosse feito por lá em vez de SQL direto.
- Sem migration nova, sem mudança de código de produção (`spreadsheet-work-editor`,
  `mission-step-row`, rotas, etc.) — só as 7 linhas de `mission_task_videos` e os 7
  arquivos em `public/videos/`. `npx tsc --noEmit`, `npm run lint`,
  `npx vitest run` (109/109, sem novos testes: nenhuma lógica de aplicação mudou) e
  `npm run build` sem erros.
- **Nota para o futuro**: quando fizer sentido financeiramente, dá para gerar uma
  versão "mais estruturada" com narração paga (Higgsfield/ILDEN) no lugar da voz
  sintetizada, ou subir os vídeos no YouTube da ILTECN e trocar `provider` para
  `YOUTUBE` — nesse caso o player embutido passa a funcionar automaticamente, sem
  nenhuma mudança de código (a `MissionTaskVideoForm` da 10.3 já tem o campo Provedor
  pronto para essa troca).

#### Correções pós-entrega da 10.4

- **`moov` no fim do arquivo (vídeo travava/carregava infinito)**: o primeiro mux com
  `ffmpeg -c copy` não usava `-movflags +faststart`, então o átomo `moov` (metadados)
  ficava depois do `mdat` (dados de mídia) — navegadores não conseguem começar a tocar
  antes de baixar o arquivo inteiro nesse layout. Corrigido remuxando os 7 arquivos com
  `-movflags +faststart` (confirmado por inspeção binária dos boxes: `ftyp → moov →
  free → mdat`).
- **Voz "falhando"/distorcendo durante a narração**: causado por *clipping* digital na
  síntese da voz `mb-br4` (mbrola) — confirmado via `ffmpeg -af astats` mostrando pico
  exatamente em 0.0 dB (batendo no teto) e um "flat factor" alto (amostras cortadas no
  topo) nas 7 narrações, junto com avisos do próprio mbrola ("Saturation on ...")
  durante a síntese. Corrigido em `build.py`: (1) reduzida a amplitude de síntese do
  espeak-ng de 100 (padrão) para `-a 78`, o suficiente para a voz não estourar o teto
  digital; (2) adicionado um passo de normalização (`ffmpeg -af
  loudnorm=I=-18:TP=-1.5:LRA=11`) depois da síntese, para deixar o volume consistente
  entre os 7 vídeos e garantir margem contra qualquer novo clipping (pico final ficou
  em torno de -1,5 dBTP em todos, sem distorção). Os 7 vídeos foram regerados do zero
  (mesmos roteiros/slides, só a narração mudou) e o `+faststart` foi mantido.
- Também nessa correção: `MissionStepRow` passou a tocar vídeo `INTERNAL`/
  `CLOUD_STORAGE` com o player `<video>` nativo do navegador, embutido na própria
  etapa (igual ao `<iframe>` do YouTube), em vez de um link que abria o arquivo numa
  aba nova — pedido do usuário para o vídeo ficar "dentro do curso".

### 10.5 — Vídeo explicativo em cada missão restante (concluída em 2026-09-15)

Depois da 10.4 (7 vídeos por etapa, só na missão "Relatório de Vendas do Mês"), o
usuário pediu vídeo explicativo em **cada uma das outras missões da plataforma**,
não por etapa — 1 vídeo cobrindo a missão inteira (contexto, objetivo, etapas,
dica), do mesmo jeito que "Contas a Pagar da Semana" ou "Requerimento de Férias".
Duas decisões confirmadas com o usuário antes de implementar:

- **Nível do vídeo**: 1 vídeo por **missão** (não por trilha/módulo) — confirmado
  porque "Informática Básica" é uma trilha com 2 missões dentro, e o usuário queria
  o mesmo padrão já usado em "Relatório de Vendas do Mês", só que sem quebrar em
  etapas.
- **Formato de produção**: mesmo pipeline gratuito da 10.4 (slides Pillow + narração
  `espeak-ng`/mbrola offline, já com a correção de clipping acima) — a conta ILDEN
  tinha 45,7 créditos no momento, insuficiente até para 1 vídeo pago de 30s (~195
  créditos), então gerar com IA paga para as 12 missões não era viável sem comprar
  mais créditos.

**Schema novo**: tabela `mission_videos` (`mission_id UUID UNIQUE REFERENCES
missions(id)`), com as mesmas colunas de `mission_task_videos` — só a chave
estrangeira muda, porque aqui a relação é 1:1 com a missão inteira, não com uma
etapa. Migração aplicada via `prepare_database_migration` +
`complete_database_migration` (confirmada com o usuário antes de aplicar, regra do
servidor Neon MCP). Também adicionada ao `tests/setup/testDb.ts` (pg-mem).

**Refatoração para reaproveitar código** (evitar triplicar a lógica de embed/
formulário entre etapa e missão):
- `VideoUpsertForm` (`src/components/video-upsert-form.tsx`): formulário de vídeo
  genérico, extraído do antigo `MissionTaskVideoForm` — usado tanto pelo vídeo de
  etapa (`endpoint: /api/missions/{id}/tasks/{taskId}/video`) quanto pelo vídeo da
  missão (`endpoint: /api/missions/{id}/video`).
- `EmbeddedVideoPlayer` (`src/components/embedded-video-player.tsx`): player
  embutido genérico, extraído do antigo `MissionStepRow` — usado tanto na etapa
  quanto no card da missão (`MissionCard`), sempre com a mesma lógica de
  YouTube/iframe vs. INTERNAL·CLOUD_STORAGE/`<video>` vs. VIMEO/link simples.
- `MissionVideoPanel` (`src/components/mission-video-form.tsx`): painel do
  professor/admin para gerenciar o vídeo da missão (tela "Formação"), ao lado do
  `MissionVideosPanel` já existente para os vídeos de etapa.

**Onde aparece para o aluno**: `MissionCard` mostra o vídeo da missão logo após os
pontos/competências, antes do link "Baixar arquivo modelo" e das etapas — porque
ele explica a missão inteira, não uma etapa específica.

**Conteúdo**: como nenhuma das 12 missões tem "Manual Guiado" rico (só
título/contexto/objetivo/etapas, mesma limitação da 10.4), o roteiro de cada vídeo
foi escrito pelo Claude Code a partir desses campos. "Comparativo de Vendas por
Vendedor" também cita "criar gráfico" numa etapa — tratado de forma conceitual na
narração, pela mesma razão da etapa 5 da 10.4 (o simulador não tem ferramenta de
gráfico).

- Sem migration em `missions`/`mission_tasks`, sem mudança de regra de negócio —
  só a tabela nova, os 12 arquivos em `public/videos/<slug>/explicativo.mp4` e as 12
  linhas de `mission_videos`. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
  (118/118, 9 novos: 5 de `mission_videos` em `tests/integration/` + 4 de
  autorização da rota `/api/missions/[id]/video`) e `npm run build` sem erros.

### 10.6 — Substituição dos 19 vídeos por gravações reais de tela (concluída em 2026-09-16)

Depois de entregar as 10.4/10.5 com slides Pillow + narração `espeak-ng` (pipeline
gratuito, usado por falta de créditos ILDEN), o usuário pediu para trocar os 19
vídeos (7 por etapa de "Relatório de Vendas do Mês" + 12 por missão) por
**gravações de tela reais**, mostrando as ações de verdade no sistema (ou, nas 2
missões sem tela própria no simulador, no Desktop/Explorer real do Windows) em vez
de slides explicativos com narração sintética.

**Produção**: as 17 gravações com tela do próprio ILTECN foram feitas com
`mcp__claude-in-chrome__gif_creator` (grava a aba do Chrome onde o simulador roda),
uma por etapa/missão, e baixadas pelo usuário para a pasta Downloads do Windows.

**As 2 exceções sem tela no simulador** — "Organização da Pasta de Trabalho" e
"Backup em Pendrive" — não têm equivalente dentro do ILTECN (são sobre organizar
pastas no Windows e copiar arquivos para um pendrive real), então precisavam
mostrar o Desktop/Explorer de verdade. Tentativas de gravar vídeo de tela nessas
duas (Ferramenta de Captura em modo vídeo, Xbox Game Bar via Win+Alt+R e
Win+Shift+R) **falharam de forma consistente**: a gravação parecia iniciar (a
barra de controle some da tela), mas a pasta `Vídeos\Capturas` nunca recebia
nenhum arquivo, em 5 tentativas distintas — 2 com a Ferramenta de Captura, 2 com o
Game Bar (uma pelo usuário, outra pelo Claude com acesso total), mais 1 mista.
Conclusão: a captura de vídeo via APIs `Windows.Graphics.Capture`/duplicação de
tela não funciona neste tipo de acesso remoto (provavelmente por não ter acesso
direto à placa de vídeo/driver de exibição), enquanto a **captura estática**
("foto"/`Win+Shift+S`) funciona de forma confiável e salva em
`Imagens\Capturas de Tela`.

**Solução**: as 2 exceções foram montadas como GIFs a partir de uma sequência de
capturas de tela estáticas reais (mesmo formato visual — GIF — das outras 17), sem
abrir nenhum arquivo sensível do Desktop real do usuário (certificados digitais,
app de token, atalho de cobrança ficaram fora de qualquer captura):
- "Organização da Pasta de Trabalho": Desktop real → pasta Downloads → pasta
  Documentos (3 capturas, mostrando a real bagunça/organização de um desktop de
  trabalho).
- "Backup em Pendrive": "Este Computador" com os discos/pendrive listados →
  pendrive aberto e vazio, pronto para copiar (2 capturas). A primeira tentativa
  de captura de "Este Computador" saiu com o painel lateral do próprio app
  Cowork sobrepondo e cortando a coluna do pendrive (o painel de conversa fica
  renderizado por cima da tela real controlada); corrigido reaproveitando uma
  segunda captura, feita com a view em modo "Detalhes" da mesma tela, sem esse
  recorte.

**Conversão GIF → MP4** (as 17 gravações reais + as 2 montadas): todas passaram
pelo mesmo pipeline ffmpeg, sem narração (são gravações de ações reais, não
slides — não fazia sentido sintetizar áudio por cima):
```bash
ffmpeg -y -i entrada.gif \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=white,fps=24,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 23 \
  -movflags +faststart \
  -an \
  saida.mp4
```
Mesma resolução/faststart da 10.4, mas sem faixa de áudio (`-an`) — o
`EmbeddedVideoPlayer` (`<video controls>`) toca normalmente vídeos sem áudio, sem
precisar de nenhuma mudança de código.

**Arquivos substituídos**: os 19 `.mp4` em `public/videos/<slug>/...` (mesmos
caminhos da 10.4/10.5, conteúdo trocado). `duration_seconds` atualizado (UPDATE
simples, sem migration) nas 7 linhas de `mission_task_videos` e nas 12 linhas de
`mission_videos` para refletir a duração real de cada gravação — os vídeos com
ações reais ficaram com durações bem diferentes dos slides (de 4s a 58s, contra a
faixa fixa de ~25-40s dos slides antigos).

- Sem migration de schema, sem mudança de regra de negócio — só os 19 arquivos de
  vídeo e as 19 atualizações de `duration_seconds`. `npx tsc --noEmit`, `npm run
  lint`, `npx vitest run` e `npm run build` sem erros (nenhum teste depende do
  conteúdo/duração dos vídeos, só de `provider`/`video_type`/URLs).

## Fase 11 — ILTECN LAB: Primeiros Passos no Computador (em produção desde 2026-10-08: migration + seed aplicados)

Segundo programa DENTRO da mesma plataforma (não é um segundo sistema): alfabetização digital
para crianças/iniciantes, 6 módulos, 30 aulas, 30h, com atividades interativas, XP, medalhas,
avaliação e certificado. Regra seguida: REUTILIZAR > ADAPTAR > CRIAR NOVO.

### Reaproveitado (nada duplicado)
Trilha→módulo→missão (`tracks`/`modules`/`missions`: cada aula é uma missão, `sort_order` = nº da
aula 1–30), etapas (`mission_tasks`), vídeos (`mission_videos`/`mission_task_videos` +
`EmbeddedVideoPlayer`), `completeMissionAttempt()` (pontos, `scores`, conquistas clássicas),
`students.points`, editor de documentos da Fase 9 (aulas 22, 23 e 26 via `work_config`),
`student_works`, `achievements`/`student_achievements`, auth/sessão, `proxy.ts`.

### Migration (aditiva, idempotente) — `migrations/2026-10-08_iltecn_lab.sql`
- `audience` ('professional'|'kids', default 'professional') em `tracks`, `students`, `achievements`.
  Sem isso as 30 aulas apareceriam para os alunos profissionais atuais (e vice-versa).
- `achievements.criteria_mission_id`, `criteria_skill` + CHECK ampliado (`track_started`,
  `mission_completed`, `skill_completed`, `challenges_completed`).
- Tabelas novas: `mission_activities` (atividade interativa; `code` único, `config` JSONB com o
  gabarito), `student_activity_progress` (tentativas, melhor nota, concluída), `track_certificates`
  (código único + `snapshot`).
- Testada numa branch temporária do Neon (migration aplicada + amostra do seed rodada duas vezes: sem
  duplicar; dados existentes intactos). **Ordem de deploy: migration → seed → deploy do código**
  (o código novo consulta `audience`).
- Rollback manual: comentado no fim do arquivo SQL (só antes de existirem dados do programa).

### Código
- `src/lib/lab/activities.ts` — tipos de atividade (choice, match, order, drag, type, files, gesture,
  draw, desktop), validação do config (`validateActivityConfig`), versão pública SEM gabarito
  (`toPublicConfig`), correção no servidor (`gradeActivity`), `scoreFromAttempts` (100/80/60/mín. 40).
- `src/lib/lab/evaluation.ts` — avaliação derivada (30% conhecimento · 50% prática · 20% projeto;
  faixas 90/80/70/60) e status de habilidade (🟢🟡🔴 sempre com texto).
- `src/lib/lab/content/*` — conteúdo das 30 aulas (95 atividades) + 15 medalhas. `src/lib/levels.ts`:
  `kidsLevel()` (Explorador→Mestre Digital; só exibição, `students.level` continua o profissional).
- `src/modules/lab/queries.ts` — painel do aluno, aula (gabarito nunca sai do servidor), `submitActivity`
  (XP pago uma única vez via `UPDATE … WHERE completed = false`), `completeLabLesson` (exige
  atividades feitas e, nas aulas de documento, trabalho entregue; chama `completeMissionAttempt`),
  medalhas, avaliação, certificado (`ILT-XXXX-XXXX`), validação pública (nome reduzido: "Maria S.").
- `src/modules/lab/monitor.ts` — acompanhamento do professor/escola; **isolamento no SQL**: admin
  tudo, coordenador só a escola, professor só as suas turmas, demais perfis nada.
- `src/modules/lab/content.ts` — CRUD de atividades (admin); "remover" só desativa (preserva histórico).
- `src/modules/lab/seed.ts` + `scripts/seed-lab.ts` (`npm run seed:lab [-- --overwrite]`): cria só o
  que falta, nunca sobrescreve edição do admin sem `--overwrite`.
- `src/modules/lab/guard.ts`: `/api/missions/complete` e `/start` recusam aulas do LAB (senão daria
  para ganhar pontos sem fazer as atividades).
- Filtros por público nos fluxos antigos: `getStudentProgress`, `getStudentReport`,
  `listAchievementsForStudent` e as 3 concessões de conquista de `completeMissionAttempt`.

### Rotas
`GET /api/lab/lessons/[id]`, `POST /api/lab/lessons/[id]/complete`,
`POST /api/lab/activities/[id]/submit` (aluno) · `GET /api/lab/monitor?classId=` (equipe, escopo no SQL) ·
`GET|POST /api/lab/missions/[id]/activities`, `PATCH|DELETE /api/lab/activities/[id]` (admin) ·
página pública `/validar/[code]` (adicionada aos caminhos públicos do `proxy.ts`).

### Telas
`/dashboard/lab` (aluno: painel com aulas x/30, XP, nível, medalhas, habilidades, avaliação; equipe:
acompanhamento com polling de 20s), `/dashboard/lab/aula/[id]` (Aprender → Ver → Praticar → Desafiar →
Conquistar, guia **LIA** com mensagens prontas), `/dashboard/lab/certificado`,
`/dashboard/lab/conteudo` (admin). Aluno `kids` vê menu enxuto e é redirecionado de `/dashboard` e
`/dashboard/missoes` para o LAB. Cadastro de aluno ganhou o campo "Programa".

### Decisões / limitações (honestas)
- Correção no servidor para escolha, ligar, ordenar, arrastar, digitar e arquivos. **Gestos do mouse,
  desenho e janelas são relatados pelo navegador** (o servidor não consegue provar um movimento); o
  custo de "trapacear" é só o XP da própria criança. Há um botão de apoio "um adulto me ajudou".
- Arrastar/ligar também funcionam por toque/clique (acessibilidade e telas de toque).
- Sem tempo real (o projeto não tem): o painel do professor faz polling a cada 20s.
- Aulas 22, 23 e 26 usam o editor da Fase 9; inserção de imagem e "apresentação" são simuladas nas
  atividades (o editor não tem imagens/slides).
- **Nenhum vídeo do LAB foi produzido** (infra reaproveitada; o admin anexa na tela Formação).
- Sem QR code no certificado (só código + página de validação). Sem rate limit na validação pública.
- Rotas antigas de relatório/trabalhos continuam com visibilidade ampla da equipe (lacuna anterior,
  não alterada); as rotas NOVAS do LAB aplicam escopo por turma/escola.
- Níveis infantis: 0/300/700/1200/1800/2500 XP; o XP do programa soma ~2.700 e só atinge "Mestre
  Digital" ao concluir o desafio final (garantido por teste).
- Testes novos: `lab-content`, `lab-solver` (toda atividade é resolvível), `lab-rules`,
  `lab-api-authorization`, `lab-seed`, `lab-queries` (programa completo de 30 aulas até o
  certificado), `lab-monitor` (isolamento por perfil). 176 testes no total.

### Redefinição de senha de aluno (2026-10-08)
`POST /api/students/[id]/reset-password` (admin/professor/coordenador) gera uma senha provisória
de 8 caracteres (ou aceita `password` informada) e a devolve **uma única vez**; no banco fica só o
hash. Escopo no SQL (`resetStudentPassword`, `src/modules/students/queries.ts`): admin = todos,
coordenador = sua escola, professor = alunos ativos nas suas turmas; fora do escopo = 404. Botão
"Redefinir senha" na tela Alunos. Sem e-mail (o projeto não tem serviço de envio); "esqueci minha
senha" por link fica como evolução. Testes: `student-password-reset` (integração) e
`student-password-reset-authorization` (rota). 187 testes.

## Central de Jogos Educativos (2026-10-09; migration `migrations/2026-10-09_games.sql`)

Motor reutilizável de jogos DENTRO da plataforma (não é um segundo sistema). Um jogo é uma sequência
de **fases**, cada fase com **desafios**; o desafio reaproveita os 9 tipos de atividade do ILTECN LAB
(`choice`, `match`, `order`, `drag`, `type`, `files`, `gesture`, `draw`, `desktop`) e o MESMO corretor
(`gradeActivity` em `src/lib/lab/activities.ts`) — verdadeiro/falso = `choice` com 2 opções; decisão com
consequência = `choice` + `explain`. XP, nível, conquistas e missões são os que já existiam.

### Arquitetura
- `src/lib/games/engine.ts` — funções PURAS: schemas Zod (`gameConfigSchema`), `validateGameConfig`,
  `toPublicPhases` (versão SEM gabarito/explicação), estado da partida (`readState`), `applyGrade`,
  `triesFactor`, `summarize`, `isPhaseOpen`, `evaluateFinish`, `starsFor`, `buildGuidance`.
- `src/lib/games/types.ts` — `gameMetaSchema` (campos editáveis pelo admin) e tipos das telas.
- `src/lib/games/content/explorador-digital.ts` — jogo-piloto (`GAME_SEEDS`).
- `src/modules/games/queries.ts` — aluno: `listGamesForStudent`, `getGameDetail`, `startAttempt`,
  `submitChallenge`, `finishAttempt`, `listPublishedGamesByMission`. Tudo que decide nota/XP/liberação roda aqui.
- `src/modules/games/results.ts` — equipe: `getGameResults`, `listScopedStudents` (escopo no SQL),
  `listGamesForStaff`, `listActorClasses`. `src/modules/games/admin.ts` — CRUD do admin + `loadAdminOptions`.
- `src/modules/games/seed.ts` + `scripts/seed-games.ts` (`npm run seed:games [-- --overwrite | -- --sql]`).
- Componentes: `src/components/games/{game-player,game-results-view,game-admin-form}.tsx`;
  `Interactive` (de `components/lab/activity-runner.tsx`) é exportado e compartilhado com o LAB.

### Dados (migration aditiva e idempotente)
`games` (config JSONB com as fases, `status` draft|published, vínculos opcionais `track_id`/`module_id`/
`mission_id`, pré-requisitos `requires_mission_id`/`requires_game_id`, `completes_mission`, `pass_percent`,
`max_attempts`, `time_limit_seconds`, `xp_reward`, `audience`), `game_attempts` (histórico: estado da
partida, `version` p/ concorrência otimista, notas, tempo, `result` JSONB; índice único parcial = no máximo
UMA partida em andamento por aluno/jogo), `student_game_progress` (tentativas, melhor nota, `completed`),
`achievements.criteria_game_id` + critério `'game_completed'`. **Não há tabela de XP nova**: continua
`students.points` + `scores`. Rollback manual comentado no fim do SQL.

### Regras (todas no servidor)
- **Nota**: pontos por desafio × fator da tentativa (1ª 100%, 2ª 70%, 3ª 50%, 4ª+ 40%); esgotar as
  tentativas do desafio = 0. Velocidade NUNCA entra. `percent = pontos ganhos / pontos possíveis`.
- **Aprovação**: todos os desafios resolvidos + nenhuma fase abaixo do seu `minPercent` + `percent >= pass_percent`.
  Estrelas: ≥95% = 3, ≥85% = 2, aprovado = 1. Fase abaixo do mínimo **trava** a partida (só dá para encerrar
  e ver orientações; nova partida recomeça).
- **Liberação de fases**: `isPhaseOpen` — a fase N só abre com as anteriores resolvidas e no mínimo. Fases
  bloqueadas chegam ao navegador SEM os desafios, e `submitChallenge` recusa (423) mesmo assim.
- **Liberação do jogo**: `requires_mission_id` (missão `concluida`) e `requires_game_id` (jogo concluído).
  NÃO altera a lógica de liberação dos cursos/missões.
- **Tentativas/tempo**: `max_attempts` conta partidas encerradas (`limit`/HTTP 429); `time_limit_seconds`
  define `expires_at`; partida vencida é encerrada como `time` (sem XP) na próxima leitura/resposta.
- **XP uma única vez por aluno/jogo**: `UPDATE student_game_progress SET completed = true ... WHERE completed = false`
  (trava de idempotência) + `UPDATE game_attempts ... WHERE status = 'in_progress'` ao encerrar. Repetir ou
  clicar duas vezes devolve o resultado salvo sem pagar de novo. Medalha por `criteria_game_id`
  (`ON CONFLICT DO NOTHING`). Jogar de novo depois de concluir é prática (entra no histórico, sem XP).
- **Integração com missão**: jogo com `mission_id` + `completes_mission` chama `completeMissionAttempt()`
  (idempotente) DEPOIS do commit do jogo, só se aprovado — a missão paga os pontos dela UMA vez, além do
  XP do jogo. O cartão da missão (`MissionCard`) mostra "🎮 Jogar" quando há jogo publicado vinculado.
- **Segurança**: o navegador só envia `challengeId` + `submission`; nota/XP/estado nunca vêm do cliente.
  `toPublicPhases` remove gabaritos e explicações (a explicação só volta DEPOIS de resolver o desafio).
  Corpo limitado (32 KB; admin 512 KB). Erros internos não vazam detalhes.

### Rotas
Aluno: `GET /api/games`, `GET /api/games/[id]`, `POST /api/games/[id]/start`,
`POST /api/games/attempts/[attemptId]/answer`, `POST /api/games/attempts/[attemptId]/finish`.
Equipe: `GET /api/games` (lista), `GET /api/games/[id]/results?classId=` (admin/professor/coordenador).
Admin: `GET|POST /api/admin/games`, `GET|PUT /api/admin/games/[id]`, `POST /api/admin/games/[id]/status`.
Telas: `/dashboard/jogos` (aluno: cartões; equipe: lista + resultados; admin: + Novo/Editar),
`/dashboard/jogos/[id]` (aluno: jogador; equipe: painel de resultados), `/novo`, `/[id]/editar` (admin).

### Painéis
- **Professor/coordenador/admin** (`getGameResults`): iniciaram/concluíram/em andamento, nota média, tentativas,
  desafios com mais erros, habilidades médias, evolução por aluno, "precisam de apoio" (≥2 tentativas sem
  aprovação ou última partida muito baixa). **Escopo no SQL**: admin todos · coordenador a escola · professor
  suas turmas · outros nada; só números (nenhuma resposta de aluno é exposta). Rascunho: só o admin.
- **Admin** (`/dashboard/jogos/novo|editar`): metadados, vínculo com trilha/módulo/missão, dificuldade, nota
  mínima, tentativas, tempo, XP, pré-requisitos, publicar/despublicar e as fases como JSON validado ao vivo
  (não é um CMS completo). Publicar exige configuração válida; "remover" = despublicar (histórico preservado).
  Só o admin cria/edita jogos; professor/coordenador só acompanham resultados.

### Jogo-piloto: "Desafio do Explorador Digital" (`desafio-explorador-digital`)
6 fases / 18 desafios, público `all`, 100 XP, aprovação 70%: componentes (arrastar, escolher, ligar), teclas
(ligar, escolher teclas, digitar), arquivos (simulador de pastas + escolha), salvar documento (ordenar, escolher,
copiar nome), internet segura (arrastar seguro/perigoso, decisão com consequência, múltipla escolha) e desafio
final combinado (janelas, pastas, ordenar, decisão). Medalha "Explorador Digital" (uma por público).

### Como criar um novo jogo
1. Escolha os desafios entre os 9 tipos do LAB (config com gabarito igual à das atividades — ver `CONFIG_SCHEMAS`).
2. **Pelo painel (admin)**: `/dashboard/jogos/novo`, cole o JSON `{ "phases": [...] }`, ajuste regras/vínculos, salve e publique.
3. **Pelo código**: crie `src/lib/games/content/<jogo>.ts` exportando um `GameSeed`, inclua em `GAME_SEEDS` e rode
   `npm run seed:games` (cria só o que falta; `--overwrite` reaplica; `--sql` imprime o SQL equivalente).
4. Cubra com `tests/unit/games-engine.test.ts`-style: toda resposta certa é aceita (`solve` de `tests/setup/labSolver.ts`).
Novo TIPO de desafio = novo `kind` em `src/lib/lab/activities.ts` (schema + `toPublicConfig` + `gradeActivity`) e
componente em `components/lab/` + `Interactive`; os jogos herdam sem mudar o motor.

### Migração e deploy
Ordem: **migration → seed → deploy do código** (o código consulta as tabelas novas). Migration via Neon MCP
`prepare_database_migration` (branch temporária) + `complete_database_migration` (sempre com confirmação do usuário).
O seed de produção pode ser aplicado com `npm run seed:games -- --sql` (SQL idempotente) por quem não alcança o Neon.

### Testes (250 no total)
`games-engine` (motor puro, piloto resolvível, gabarito não vaza), `games-queries` (carregar, iniciar/retomar,
fases/bloqueio, tentativas, tempo, XP uma vez, duplo clique, histórico, melhor nota, liberação por missão/jogo,
conclusão de missão, administração), `games-results` (isolamento por escola/turma/perfil, indicadores),
`games-api-authorization` (papéis, validação, nota/XP do cliente ignorados), `games-seed-sql`.
Limitação conhecida: a disputa real de duas respostas simultâneas é protegida por `WHERE version = N` e pelo
índice único parcial, mas o pg-mem não reproduz concorrência real — não há teste de corrida de verdade.

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm test         # vitest run (unit + integration, sem rede)
npm run lint     # eslint
npm run seed     # cria admin + escola modelo (precisa de DATABASE_URL)
npm run seed:lab # semeia o ILTECN LAB (depois da migration; idempotente)
npm run seed:games # semeia a Central de Jogos (depois da migration 2026-10-09; idempotente)
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
