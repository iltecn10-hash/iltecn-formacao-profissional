-- Conselho de Classe — avaliações (Etapa 4). Requer 2026-10-15_conselho_base.sql.
-- Migration ADITIVA e idempotente: só CREATE TABLE/INDEX IF NOT EXISTS; nada existente é alterado.
--
-- council_evaluations: UMA avaliação por turma + disciplina + bimestre + aluno.
--   answers (JSONB) guarda, por critério, o código, o texto do critério e o texto da opção NO MOMENTO
--   da resposta — assim, editar ou desativar um critério depois não reescreve o histórico.
--   version = concorrência otimista (dois cliques/abas não sobrescrevem um ao outro).
--   status: 'draft' (rascunho, editável pelo professor) | 'final' (travada; só a coordenação reabre).
-- council_evaluation_events: trilha de auditoria (quem criou/salvou/finalizou/reabriu e quando).
-- Observação pedagógica = dado sensível de aluno: o acesso é sempre decidido no servidor, por escola/vínculo.

CREATE TABLE IF NOT EXISTS council_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  period_id UUID NOT NULL REFERENCES evaluation_periods(id),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  answers JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id, period_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_council_eval_student ON council_evaluations (student_id);
CREATE INDEX IF NOT EXISTS idx_council_eval_period ON council_evaluations (school_id, period_id);

CREATE TABLE IF NOT EXISTS council_evaluation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES council_evaluations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(12) NOT NULL CHECK (action IN ('created', 'saved', 'finalized', 'reopened')),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_council_events_eval ON council_evaluation_events (evaluation_id, created_at);

-- Rollback manual (só antes de existirem dados):
-- DROP TABLE council_evaluation_events, council_evaluations;
