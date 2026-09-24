-- ==============================================================================
-- PROJETO: CALENDÁRIO PESSOAL
-- ETAPA: F1.11B — LEMBRETES E METAS (TABELA sidebar_cards)
-- ==============================================================================

-- 1. Garantir extensão pgcrypto para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criar tabela public.sidebar_cards
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

-- 3. Índices Estratégicos
CREATE INDEX IF NOT EXISTS idx_sidebar_cards_type 
  ON public.sidebar_cards (type);

CREATE INDEX IF NOT EXISTS idx_sidebar_cards_created_at 
  ON public.sidebar_cards (created_at ASC);

-- 4. Trigger de Atualização Automática de updated_at
-- Reutiliza a função genérica existente public.update_updated_at_column()
DROP TRIGGER IF EXISTS trigger_sidebar_cards_updated_at ON public.sidebar_cards;

CREATE TRIGGER trigger_sidebar_cards_updated_at
  BEFORE UPDATE ON public.sidebar_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Segurança / RLS (Modelo homologado sem autenticação para uso pessoal)
ALTER TABLE public.sidebar_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo publico para sidebar_cards" ON public.sidebar_cards;

CREATE POLICY "Permitir acesso completo publico para sidebar_cards"
  ON public.sidebar_cards
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Concessão de Privilégios para roles anon e authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sidebar_cards TO anon, authenticated;
