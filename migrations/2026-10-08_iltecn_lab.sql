-- ILTECN LAB — Primeiros Passos no Computador
-- Migration ADITIVA e idempotente (pode rodar mais de uma vez sem efeito colateral).
-- Nenhuma coluna/tabela existente é removida ou tem dados alterados.
--
-- Justificativa de cada item (regra: REUTILIZAR > ADAPTAR > CRIAR NOVO):
--   * audience em tracks/students/achievements: hoje todo aluno enxerga TODAS as
--     trilhas e todas as conquistas. Sem separar o público, 30 aulas infantis
--     apareceriam para os alunos profissionais atuais (e vice-versa). DEFAULT
--     'professional' mantém o comportamento atual para tudo que já existe.
--   * achievements.criteria_*: o CHECK atual só aceita 3 tipos; o programa precisa
--     de "primeiro acesso", "aula concluída", "habilidade concluída" e "desafios".
--   * mission_activities / student_activity_progress: o sistema não tem o conceito
--     de atividade interativa (mission_tasks é só texto). Sem tabela própria não
--     dá para medir tentativas, dificuldade e domínio por habilidade.
--   * track_certificates: o certificado atual é só uma página calculada na hora,
--     sem código único nem validação pública.

-- 1. Público (audience) -------------------------------------------------------
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'professional'
  CHECK (audience IN ('professional', 'kids'));

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'professional'
  CHECK (audience IN ('professional', 'kids'));

ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'professional'
  CHECK (audience IN ('professional', 'kids'));

-- 2. Novos critérios de conquista --------------------------------------------
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS criteria_mission_id UUID REFERENCES missions(id) ON DELETE CASCADE;

ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS criteria_skill VARCHAR(20);

ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_criteria_type_check;
ALTER TABLE achievements
  ADD CONSTRAINT achievements_criteria_type_check
  CHECK (criteria_type IN (
    'missions_completed', 'points', 'track_completed',
    'track_started', 'mission_completed', 'skill_completed', 'challenges_completed'
  ));

-- 3. Atividades interativas ---------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind VARCHAR(20) NOT NULL
    CHECK (kind IN ('choice', 'match', 'order', 'drag', 'type', 'files', 'gesture', 'draw', 'desktop')),
  category VARCHAR(20) NOT NULL DEFAULT 'practice'
    CHECK (category IN ('knowledge', 'practice', 'challenge')),
  skill VARCHAR(20) NOT NULL
    CHECK (skill IN ('computador', 'mouse', 'teclado', 'arquivos', 'producao', 'internet', 'seguranca')),
  title VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  xp INTEGER NOT NULL DEFAULT 20,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_activities_mission
  ON mission_activities (mission_id, sort_order);

CREATE TABLE IF NOT EXISTS student_activity_progress (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES mission_activities(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, activity_id)
);

-- 4. Certificado com código único e validação pública --------------------------
CREATE TABLE IF NOT EXISTS track_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  score INTEGER NOT NULL,
  workload_hours INTEGER NOT NULL DEFAULT 30,
  snapshot JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, track_id)
);

-- Rollback (manual, só se necessário e SOMENTE antes de haver dados do programa):
--   DROP TABLE IF EXISTS track_certificates;
--   DROP TABLE IF EXISTS student_activity_progress;
--   DROP TABLE IF EXISTS mission_activities;
--   ALTER TABLE achievements DROP COLUMN IF EXISTS criteria_skill, DROP COLUMN IF EXISTS criteria_mission_id, DROP COLUMN IF EXISTS audience;
--   ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_criteria_type_check;
--   ALTER TABLE achievements ADD CONSTRAINT achievements_criteria_type_check CHECK (criteria_type IN ('missions_completed','points','track_completed'));
--   ALTER TABLE students DROP COLUMN IF EXISTS audience;
--   ALTER TABLE tracks DROP COLUMN IF EXISTS audience;
