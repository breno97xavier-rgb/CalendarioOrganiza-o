import { supabase } from '../lib/supabase';
import {
  SidebarCard,
  CreateSidebarCardInput,
  UpdateSidebarCardInput,
} from '../types/sidebar';

export const sidebarCardService = {
  /**
   * Busca todos os cards da barra lateral (lembretes e metas).
   * Ordenação: created_at ASC (cards mais antigos primeiro, novos depois).
   */
  async getSidebarCards(): Promise<SidebarCard[]> {
    const { data, error } = await supabase
      .from('sidebar_cards')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar cards da lateral: ${error.message}`);
    }

    return (data as SidebarCard[]) || [];
  },

  /**
   * Busca um único card da lateral pelo ID
   */
  async getSidebarCardById(id: string): Promise<SidebarCard> {
    const { data, error } = await supabase
      .from('sidebar_cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar card da lateral ${id}: ${error.message}`);
    }

    return data as SidebarCard;
  },

  /**
   * Cria um novo lembrete ou meta na barra lateral
   */
  async createSidebarCard(input: CreateSidebarCardInput): Promise<SidebarCard> {
    const trimmedContent = input.content.trim();
    const trimmedColor = input.color.trim();

    if (!trimmedContent) {
      throw new Error('O conteúdo do card não pode estar vazio.');
    }

    if (!trimmedColor) {
      throw new Error('A cor do card não pode estar vazia.');
    }

    if (input.type !== 'reminder' && input.type !== 'goal') {
      throw new Error('O tipo do card deve ser "reminder" ou "goal".');
    }

    const payload = {
      type: input.type,
      content: trimmedContent,
      color: trimmedColor,
    };

    const { data, error } = await supabase
      .from('sidebar_cards')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar card na lateral: ${error.message}`);
    }

    return data as SidebarCard;
  },

  /**
   * Atualiza um card da lateral (lembrete ou meta) pelo ID
   */
  async updateSidebarCard(
    id: string,
    input: UpdateSidebarCardInput
  ): Promise<SidebarCard> {
    const payload: Record<string, unknown> = {};

    if (input.type !== undefined) {
      if (input.type !== 'reminder' && input.type !== 'goal') {
        throw new Error('O tipo do card deve ser "reminder" ou "goal".');
      }
      payload.type = input.type;
    }

    if (input.content !== undefined) {
      const trimmedContent = input.content.trim();
      if (!trimmedContent) {
        throw new Error('O conteúdo do card não pode estar vazio.');
      }
      payload.content = trimmedContent;
    }

    if (input.color !== undefined) {
      const trimmedColor = input.color.trim();
      if (!trimmedColor) {
        throw new Error('A cor do card não pode estar vazia.');
      }
      payload.color = trimmedColor;
    }

    const { data, error } = await supabase
      .from('sidebar_cards')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar card da lateral ${id}: ${error.message}`);
    }

    return data as SidebarCard;
  },

  /**
   * Exclui um card da lateral pelo ID
   */
  async deleteSidebarCard(id: string): Promise<void> {
    const { error } = await supabase
      .from('sidebar_cards')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao excluir card da lateral ${id}: ${error.message}`);
    }
  },
};
