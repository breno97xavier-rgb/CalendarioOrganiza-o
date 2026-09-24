/**
 * Tipos e interfaces para Lembretes e Metas da Barra Lateral (sidebar_cards)
 */

export type SidebarCardType = 'reminder' | 'goal';

export interface SidebarCard {
  id: string;
  type: SidebarCardType;
  content: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSidebarCardInput {
  type: SidebarCardType;
  content: string;
  color: string;
}

export interface UpdateSidebarCardInput {
  type?: SidebarCardType;
  content?: string;
  color?: string;
}
