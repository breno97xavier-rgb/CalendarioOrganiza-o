-- ==============================================================================
-- PROJETO: CALENDÁRIO PESSOAL
-- ETAPA: F1.5 — RECORRÊNCIAS FUNCIONAIS
-- MIGRAÇÃO INCREMENTAL: AJUSTE DE CONSTRAINT check_recurrence_unit
-- ==============================================================================

-- 1. Garantir que a coluna recurrence_unit existe
ALTER TABLE public.calendar_cards 
  ADD COLUMN IF NOT EXISTS recurrence_unit TEXT NULL;

-- 2. Remover a constraint anterior
ALTER TABLE public.calendar_cards 
  DROP CONSTRAINT IF EXISTS check_recurrence_unit;

-- 3. Recriar com IS NOT NULL explícito para evitar que NULL passe na lógica trivalente do PostgreSQL:
ALTER TABLE public.calendar_cards 
  ADD CONSTRAINT check_recurrence_unit CHECK (
    (recurrence_type <> 'custom' AND recurrence_unit IS NULL) OR
    (recurrence_type = 'custom' AND recurrence_unit IS NOT NULL AND recurrence_unit IN ('day', 'week', 'month'))
  );
