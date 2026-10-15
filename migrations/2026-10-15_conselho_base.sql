-- Conselho de Classe — Etapas 1 a 3 (base de cadastros)
-- Migration ADITIVA e idempotente. Só CREATE TABLE/INDEX IF NOT EXISTS: nenhuma tabela ou
-- coluna existente é alterada e nenhum dado é inserido (os padrões — disciplinas, bimestres
-- e critérios — são criados pelo código, por escola, na primeira vez que são necessários).
--
-- Por que tabelas novas (REUTILIZAR > ADAPTAR > CRIAR NOVO): o banco não tem disciplinas,
-- períodos/bimestres nem vínculo professor x turma x disciplina (classes.teacher_id é só o
-- professor responsável pela turma). Turmas, professores, alunos e matrículas são reaproveitados.

-- Disciplinas (componentes curriculares), por escola. name_key = nome normalizado (minúsculas,
-- sem espaços sobrando) para impedir duplicidade na mesma escola.
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  name_key VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name_key)
);

-- Quem leciona o quê em cada turma. Uma disciplina tem um professor por turma.
CREATE TABLE IF NOT EXISTS class_subject_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_cst_teacher ON class_subject_teachers (teacher_id) WHERE active;

-- Períodos de avaliação (bimestres) por escola e ano letivo.
CREATE TABLE IF NOT EXISTS evaluation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year INTEGER NOT NULL CHECK (school_year BETWEEN 2020 AND 2100),
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 1 AND 12),
  name VARCHAR(80) NOT NULL,
  starts_on DATE,
  ends_on DATE,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, school_year, sort_order)
);

-- Critérios do formulário, configuráveis por escola. kind: 'level' (escolha entre opções),
-- 'yesno' (Sim/Não) ou 'text' (observação livre). Desativar preserva respostas antigas.
CREATE TABLE IF NOT EXISTS council_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code VARCHAR(60) NOT NULL,
  label VARCHAR(200) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('level', 'yesno', 'text')),
  options JSONB NOT NULL DEFAULT '[]',
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

-- Rollback manual (só antes de existirem dados):
-- DROP TABLE council_criteria, evaluation_periods, class_subject_teachers, subjects;
