-- ==============================================================================
-- PROJETO: CALENDÁRIO PESSOAL
-- ETAPA: F1.5 — RECORRÊNCIAS FUNCIONAIS
-- SCHEMA DEFINITIVO DA TABELA calendar_cards
-- ==============================================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela Principal
CREATE TABLE IF NOT EXISTS public.calendar_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  color TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME WITHOUT TIME ZONE NULL,
  recurrence_type TEXT NOT NULL DEFAULT 'none',
  recurrence_interval INTEGER NOT NULL DEFAULT 1,
  recurrence_unit TEXT NULL,
  recurrence_days SMALLINT[] NULL,
  recurrence_end_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT check_recurrence_type CHECK (
    recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')
  ),
  CONSTRAINT check_recurrence_interval CHECK (
    recurrence_interval >= 1
  ),
  CONSTRAINT check_recurrence_unit CHECK (
    (recurrence_type <> 'custom' AND recurrence_unit IS NULL) OR
    (recurrence_type = 'custom' AND recurrence_unit IS NOT NULL AND recurrence_unit IN ('day', 'week', 'month'))
  ),
  CONSTRAINT check_recurrence_days CHECK (
    recurrence_days IS NULL OR (
      recurrence_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[] AND
      array_length(recurrence_days, 1) > 0
    )
  ),
  CONSTRAINT check_recurrence_end_date CHECK (
    recurrence_end_date IS NULL OR recurrence_end_date >= date
  ),
  CONSTRAINT check_content_not_empty CHECK (
    trim(content) <> ''
  ),
  CONSTRAINT check_color_not_empty CHECK (
    trim(color) <> ''
  )
);

-- 3. Índices Estratégicos
CREATE INDEX IF NOT EXISTS idx_calendar_cards_date 
  ON public.calendar_cards (date);

CREATE INDEX IF NOT EXISTS idx_calendar_cards_recurrence 
  ON public.calendar_cards (recurrence_type);

-- 4. Função e Trigger para Atualização Automática de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calendar_cards_updated_at ON public.calendar_cards;

CREATE TRIGGER trigger_calendar_cards_updated_at
  BEFORE UPDATE ON public.calendar_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Segurança / RLS (Acesso Direto sem Autenticação)
ALTER TABLE public.calendar_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo publico para aplicacao pessoal" ON public.calendar_cards;

CREATE POLICY "Permitir acesso completo publico para aplicacao pessoal"
  ON public.calendar_cards
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Concessão de Privilégios de Tabela para as roles anon e authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_cards TO anon, authenticated;

-- ==============================================================================
-- ETAPA: F1.11B — LEMBRETES E METAS (TABELA sidebar_cards)
-- ==============================================================================

-- 7. Tabela de Cards da Barra Lateral (Lembretes e Metas sem data)
CREATE TABLE IF NOT EXISTS public.sidebar_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT check_sidebar_card_type CHECK (
    type IN ('reminder', 'goal')
  ),
  CONSTRAINT check_sidebar_card_content_not_empty CHECK (
    trim(content) <> ''
  ),
  CONSTRAINT check_sidebar_card_color_not_empty CHECK (
    trim(color) <> ''
  )
);

-- 8. Índices Estratégicos para sidebar_cards
CREATE INDEX IF NOT EXISTS idx_sidebar_cards_type 
  ON public.sidebar_cards (type);

CREATE INDEX IF NOT EXISTS idx_sidebar_cards_created_at 
  ON public.sidebar_cards (created_at ASC);

-- 9. Trigger de Atualização Automática de updated_at para sidebar_cards
DROP TRIGGER IF EXISTS trigger_sidebar_cards_updated_at ON public.sidebar_cards;

CREATE TRIGGER trigger_sidebar_cards_updated_at
  BEFORE UPDATE ON public.sidebar_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Segurança / RLS para sidebar_cards
ALTER TABLE public.sidebar_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo publico para sidebar_cards" ON public.sidebar_cards;

CREATE POLICY "Permitir acesso completo publico para sidebar_cards"
  ON public.sidebar_cards
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sidebar_cards TO anon, authenticated;

