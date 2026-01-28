-- Refatoração da tabela education_levels com granularidade de status
-- Diferencia níveis "em curso" de "concluído"
-- IMPORTANTE: Preserva perfis de usuários, apenas reseta education_id

-- Passo 1: Remover referências de education_id nos perfis existentes
-- Isso evita violação de foreign key quando limparmos education_levels
UPDATE profiles SET education_id = NULL WHERE education_id IS NOT NULL;

-- Passo 2: Limpar tabela education_levels (SEM CASCADE para não deletar perfis!)
TRUNCATE TABLE education_levels RESTART IDENTITY;

-- Passo 3: Adicionar coluna sort_order se não existir
ALTER TABLE education_levels ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Passo 4: Inserir novos níveis ordenados
INSERT INTO education_levels (key, sort_order) VALUES
  ('high_school_student', 10),
  ('college_student', 20),
  ('graduate', 30),
  ('masters_student', 40),
  ('masters_degree', 50),
  ('doctorate_student', 60),
  ('doctorate_degree', 70);

-- Passo 5: Criar índice para ordenação
CREATE INDEX IF NOT EXISTS idx_education_levels_sort_order ON education_levels(sort_order);

-- Comentários para documentação
COMMENT ON COLUMN education_levels.sort_order IS 'Ordem de exibição dos níveis educacionais (10, 20, 30...)';
COMMENT ON TABLE education_levels IS 'Níveis educacionais com granularidade de status (em curso vs concluído)';

