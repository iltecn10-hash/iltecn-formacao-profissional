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

### Próximas subfases

9.2 Editor de documentos → 9.3 Editor de planilhas → 9.4 Integração com missões (campo de
configuração em `missions`, ex. `work_config JSONB`) → 9.5 Entrega e avaliação → 9.6
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
