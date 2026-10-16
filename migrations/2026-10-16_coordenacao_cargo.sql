-- Coordenação e direção — cargo do perfil "coordinator"
-- Migration ADITIVA e idempotente: só ADD COLUMN IF NOT EXISTS com valor padrão.
-- O Diretor usa o MESMO perfil/acesso do Coordenador (role = 'coordinator'); a coluna só
-- guarda como a pessoa é chamada na tela. Registros existentes viram 'coordenador'.
ALTER TABLE coordinators
  ADD COLUMN IF NOT EXISTS position VARCHAR(20) NOT NULL DEFAULT 'coordenador';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coordinators_position_check') THEN
    ALTER TABLE coordinators
      ADD CONSTRAINT coordinators_position_check CHECK (position IN ('coordenador', 'diretor'));
  END IF;
END $$;

-- Rollback manual (só antes de existir dado que dependa do cargo):
--   ALTER TABLE coordinators DROP CONSTRAINT IF EXISTS coordinators_position_check;
--   ALTER TABLE coordinators DROP COLUMN IF EXISTS position;
