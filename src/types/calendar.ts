/**
 * Tipos e interfaces do Calendário Pessoal
 */

export type CalendarView = 'month' | 'week' | 'day' | 'year';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export type RecurrenceUnit = 'day' | 'week' | 'month';

/**
 * Representação completa da tabela public.calendar_cards do Supabase
 */
export interface CalendarCard {
  id: string;
  content: string;
  color: string;
  date: string; // Formato YYYY-MM-DD
  time: string | null; // Formato HH:mm[:ss] ou null
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_unit: RecurrenceUnit | null;
  recurrence_days: number[] | null; // 1 (segunda) a 7 (domingo)
  recurrence_end_date: string | null; // Formato YYYY-MM-DD ou null
  created_at: string; // Timestamptz ISO
  updated_at: string; // Timestamptz ISO
}

/**
 * Representação de uma ocorrência virtual calculada em tempo de execução
 */
export interface CalendarOccurrence {
  occurrenceKey: string; // Ex: `${card.id}:${occurrenceDate}`
  cardId: string;
  card: CalendarCard;
  occurrenceDate: string; // Formato YYYY-MM-DD
  content: string;
  color: string;
  time: string | null;
  isRecurring: boolean;
}

/**
 * Dados para inserção de um novo card
 */
export interface CreateCalendarCardInput {
  content: string;
  color: string;
  date: string;
  time?: string | null;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_unit?: RecurrenceUnit | null;
  recurrence_days?: number[] | null;
  recurrence_end_date?: string | null;
}

/**
 * Dados para atualização de um card existente
 */
export interface UpdateCalendarCardInput {
  content?: string;
  color?: string;
  date?: string;
  time?: string | null;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_unit?: RecurrenceUnit | null;
  recurrence_days?: number[] | null;
  recurrence_end_date?: string | null;
}

export interface ColorOption {
  id: string;
  hex: string;
}

export interface CalendarDay {
  date: Date;
  dateString: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}
