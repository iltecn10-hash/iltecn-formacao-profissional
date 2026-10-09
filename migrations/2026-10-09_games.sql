-- Central de Jogos Educativos ILTECN
-- Migration ADITIVA e idempotente (pode rodar mais de uma vez sem efeito colateral).
-- Nenhuma coluna/tabela existente é removida; dados existentes não são alterados.
-- Requer a migration 2026-10-08_iltecn_lab.sql (usa achievements.audience e o CHECK ampliado).
--
-- Justificativa (regra: REUTILIZAR > ADAPTAR > CRIAR NOVO):
--   * games: não existe o conceito de "jogo" (sequência de fases/desafios com regras de
--     aprovação, tentativas e vínculo com curso/módulo/missão). As atividades do LAB
--     (mission_activities) são avulsas e presas a uma aula do LAB, então não servem de
--     contêiner. Os DESAFIOS de um jogo, porém, reaproveitam 100% os tipos e o corretor
--     das atividades do LAB (src/lib/lab/activities.ts); só a configuração fica em JSONB.
--   * game_attempts: histórico de cada partida (pontuação, % de acerto, tempo, erros,
--     situação, XP, habilidades). Guarda também o estado da partida em andamento — é o que
--     permite validar tudo no servidor (o navegador nunca envia pontuação).
--   * student_game_progress: espelha student_activity_progress — a linha com
--     completed = false é a "trava" que paga o XP UMA única vez (UPDATE ... WHERE completed = false).
--   * achievements.criteria_game_id + 'game_completed': medalha ao concluir um jogo,
--     usando a tabela de conquistas que já existe.
-- XP e pontos NÃO ganham tabela nova: continuam em students.points + scores.

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  audience VARCHAR(20) NOT NULL DEFAULT 'all'
    CHECK (audience IN ('professional', 'kids', 'all')),
  difficulty VARCHAR(10) NOT NULL DEFAULT 'facil'
    CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  game_type VARCHAR(20) NOT NULL DEFAULT 'mixed'
    CHECK (game_type IN ('quiz', 'practice', 'simulation', 'mixed')),
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  requires_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  requires_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  completes_mission BOOLEAN NOT NULL DEFAULT false,
  pass_percent INTEGER NOT NULL DEFAULT 70
    CHECK (pass_percent BETWEEN 1 AND 100),
  max_attempts INTEGER
    CHECK (max_attempts IS NULL OR max_attempts BETWEEN 1 AND 100),
  time_limit_seconds INTEGER
    CHECK (time_limit_seconds IS NULL OR time_limit_seconds BETWEEN 30 AND 7200),
  xp_reward INTEGER NOT NULL DEFAULT 50
    CHECK (xp_reward BETWEEN 0 AND 500),
  config JSONB NOT NULL DEFAULT '{"phases": []}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games (status, sort_order);
CREATE INDEX IF NOT EXISTS idx_games_mission ON games (mission_id);

CREATE TABLE IF NOT EXISTS game_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'passed', 'failed')),
  -- Estado da partida (tentativas por desafio, pontos). Só o servidor escreve aqui.
  state JSONB NOT NULL DEFAULT '{}',
  -- Controle de concorrência otimista: duas respostas simultâneas não se sobrescrevem.
  version INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  ended_reason VARCHAR(12)
    CHECK (ended_reason IS NULL OR ended_reason IN ('completed', 'time', 'left')),
  score_percent INTEGER,
  points INTEGER,
  points_possible INTEGER,
  correct_count INTEGER,
  wrong_count INTEGER,
  duration_seconds INTEGER,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  -- Resumo por fase, habilidade e desafio (alimenta o painel do professor).
  result JSONB
);

CREATE INDEX IF NOT EXISTS idx_game_attempts_student
  ON game_attempts (student_id, game_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_attempts_game
  ON game_attempts (game_id, started_at DESC);
-- No máximo UMA partida em andamento por aluno e jogo (evita partidas duplicadas por clique duplo).
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_attempt_open
  ON game_attempts (game_id, student_id) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS student_game_progress (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  best_percent INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, game_id)
);

-- Conquista ao concluir um jogo (reaproveita achievements/student_achievements).
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS criteria_game_id UUID REFERENCES games(id) ON DELETE CASCADE;

ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_criteria_type_check;
ALTER TABLE achievements
  ADD CONSTRAINT achievements_criteria_type_check
  CHECK (criteria_type IN (
    'missions_completed', 'points', 'track_completed',
    'track_started', 'mission_completed', 'skill_completed', 'challenges_completed',
    'game_completed'
  ));

-- Rollback (manual, só se necessário e SOMENTE antes de haver partidas registradas):
--   DELETE FROM achievements WHERE criteria_type = 'game_completed';
--   ALTER TABLE achievements DROP COLUMN IF EXISTS criteria_game_id;
--   ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_criteria_type_check;
--   ALTER TABLE achievements ADD CONSTRAINT achievements_criteria_type_check CHECK (criteria_type IN (
--     'missions_completed','points','track_completed','track_started','mission_completed','skill_completed','challenges_completed'));
--   DROP TABLE IF EXISTS student_game_progress;
--   DROP TABLE IF EXISTS game_attempts;
--   DROP TABLE IF EXISTS games;
