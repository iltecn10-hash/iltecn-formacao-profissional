-- Atividades da turma: o professor cadastra uma atividade (com materiais para baixar), o aluno
-- entrega arquivos, o professor avalia. Migration ADITIVA e idempotente (só CREATE ... IF NOT EXISTS).
-- Os arquivos ficam no próprio Postgres (BYTEA, limite de 4 MB por envio imposto pelo servidor):
-- o projeto não tem armazenamento de objetos. Nunca se lê a coluna data em listagens.

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  instructions TEXT,
  due_date DATE,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10,
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments (class_id);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id),
  student_id UUID NOT NULL REFERENCES students(id),
  comment TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'returned', 'evaluated')),
  score NUMERIC(5,2),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_at TIMESTAMPTZ,
  evaluated_by UUID REFERENCES users(id),
  UNIQUE (assignment_id, student_id)
);

-- Arquivos: kind 'material' (do professor, ligado à atividade) ou 'delivery' (do aluno, ligado à entrega).
CREATE TABLE IF NOT EXISTS assignment_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id),
  submission_id UUID REFERENCES assignment_submissions(id),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('material', 'delivery')),
  file_name VARCHAR(200) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BYTEA NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignment_files_assignment ON assignment_files (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_files_submission ON assignment_files (submission_id);

-- Rollback manual (só antes de existirem dados):
--   DROP TABLE IF EXISTS assignment_files; DROP TABLE IF EXISTS assignment_submissions; DROP TABLE IF EXISTS assignments;
