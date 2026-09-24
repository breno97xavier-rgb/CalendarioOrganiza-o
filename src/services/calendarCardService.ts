import { supabase } from '../lib/supabase';
import {
  CalendarCard,
  CreateCalendarCardInput,
  UpdateCalendarCardInput,
} from '../types/calendar';

export const calendarCardService = {
  /**
   * Consulta os cards em um intervalo de datas.
   * Recupera:
   * A) Cards não recorrentes cuja data esteja dentro do intervalo [startDate, endDate].
   * B) Cards recorrentes cuja data de início seja <= endDate e cuja data final seja nula OU >= startDate.
   */
  async getCards(startDate: string, endDate: string): Promise<CalendarCard[]> {
    const filter = [
      `and(recurrence_type.eq.none,date.gte.${startDate},date.lte.${endDate})`,
      `and(recurrence_type.neq.none,date.lte.${endDate},recurrence_end_date.is.null)`,
      `and(recurrence_type.neq.none,date.lte.${endDate},recurrence_end_date.gte.${startDate})`,
    ].join(',');

    const { data, error } = await supabase
      .from('calendar_cards')
      .select('*')
      .or(filter)
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: false });

    if (error) {
      throw new Error(`Erro ao buscar cards por intervalo: ${error.message}`);
    }

    return (data as CalendarCard[]) || [];
  },

  /**
   * Busca um único card pelo seu ID
   */
  async getCardById(id: string): Promise<CalendarCard> {
    const { data, error } = await supabase
      .from('calendar_cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar card ${id}: ${error.message}`);
    }

    return data as CalendarCard;
  },

  /**
   * Cria um novo card no banco de dados
   */
  async createCard(input: CreateCalendarCardInput): Promise<CalendarCard> {
    if (input.recurrence_type === 'custom') {
      if (!input.recurrence_unit || !['day', 'week', 'month'].includes(input.recurrence_unit)) {
        throw new Error('Para cards com recorrência customizada, recurrence_unit é obrigatório e deve ser "day", "week" ou "month".');
      }
      if (input.recurrence_unit === 'week' && (!input.recurrence_days || input.recurrence_days.length === 0)) {
        throw new Error('Para cards com recorrência semanal customizada, ao menos um dia da semana deve ser selecionado.');
      }
    }

    const payload = {
      content: input.content.trim(),
      color: input.color.trim(),
      date: input.date,
      time: input.time ?? null,
      recurrence_type: input.recurrence_type ?? 'none',
      recurrence_interval: input.recurrence_interval ?? 1,
      recurrence_unit: input.recurrence_unit ?? null,
      recurrence_days: input.recurrence_days ?? null,
      recurrence_end_date: input.recurrence_end_date ?? null,
    };

    const { data, error } = await supabase
      .from('calendar_cards')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar card: ${error.message}`);
    }

    return data as CalendarCard;
  },

  /**
   * Atualiza um card existente pelo ID
   */
  async updateCard(
    id: string,
    input: UpdateCalendarCardInput
  ): Promise<CalendarCard> {
    const payload: Record<string, unknown> = {};

    if (input.content !== undefined) payload.content = input.content.trim();
    if (input.color !== undefined) payload.color = input.color.trim();
    if (input.date !== undefined) payload.date = input.date;
    if (input.time !== undefined) payload.time = input.time;
    if (input.recurrence_type !== undefined)
      payload.recurrence_type = input.recurrence_type;
    if (input.recurrence_interval !== undefined)
      payload.recurrence_interval = input.recurrence_interval;
    if (input.recurrence_unit !== undefined)
      payload.recurrence_unit = input.recurrence_unit;
    if (input.recurrence_days !== undefined)
      payload.recurrence_days = input.recurrence_days;
    if (input.recurrence_end_date !== undefined)
      payload.recurrence_end_date = input.recurrence_end_date;

    const { data, error } = await supabase
      .from('calendar_cards')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar card ${id}: ${error.message}`);
    }

    return data as CalendarCard;
  },

  /**
   * Exclui um card pelo ID
   */
  async deleteCard(id: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_cards')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao excluir card ${id}: ${error.message}`);
    }
  },

  /**
   * Duplica um card existente:
   * 1. Recupera o card original
   * 2. Desestrutura removendo id, created_at e updated_at
   * 3. Insere como um novo registro (gerando novo UUID e timestamps)
   */
  async duplicateCard(id: string): Promise<CalendarCard> {
    const original = await this.getCardById(id);

    return this.createCard({
      content: original.content,
      color: original.color,
      date: original.date,
      time: original.time,
      recurrence_type: original.recurrence_type,
      recurrence_interval: original.recurrence_interval,
      recurrence_unit: original.recurrence_unit,
      recurrence_days: original.recurrence_days,
      recurrence_end_date: original.recurrence_end_date,
    });
  },
};
