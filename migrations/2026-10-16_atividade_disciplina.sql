-- Atividades da turma: disciplina (opcional). Aditiva; atividades antigas ficam sem disciplina.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
-- Rollback manual: ALTER TABLE assignments DROP COLUMN subject_id;
