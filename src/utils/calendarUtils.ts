import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDay, ColorOption, CalendarCard } from '../types/calendar';

export const WEEK_DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;

/**
 * 15 cores da paleta oficial (fonte única da aplicação):
 * 1. vermelho, 2. vinho, 3. rosa, 4. coral, 5. laranja, 
 * 6. amarelo, 7. verde-lima suave, 8. verde, 9. verde-escuro, 
 * 10. turquesa, 11. azul-claro, 12. azul, 13. azul-marinho, 
 * 14. roxo, 15. cinza.
 */
export const COLOR_PALETTE: ColorOption[] = [
  { id: 'c1', hex: '#DC2626' }, // 1. vermelho
  { id: 'c2', hex: '#831843' }, // 2. vinho
  { id: 'c3', hex: '#DB2777' }, // 3. rosa
  { id: 'c4', hex: '#F97066' }, // 4. coral
  { id: 'c5', hex: '#EA580C' }, // 5. laranja
  { id: 'c6', hex: '#D97706' }, // 6. amarelo
  { id: 'c7', hex: '#84CC16' }, // 7. verde-lima suave
  { id: 'c8', hex: '#16A34A' }, // 8. verde
  { id: 'c9', hex: '#166534' }, // 9. verde-escuro
  { id: 'c10', hex: '#0D9488' }, // 10. turquesa
  { id: 'c11', hex: '#0284C7' }, // 11. azul-claro
  { id: 'c12', hex: '#2563EB' }, // 12. azul
  { id: 'c13', hex: '#1E3A8A' }, // 13. azul-marinho
  { id: 'c14', hex: '#7C3AED' }, // 14. roxo
  { id: 'c15', hex: '#64748B' }, // 15. cinza
];

/**
 * Calcula a cor de texto contrastante (clara ou escura) para garantir legibilidade
 * sobre qualquer uma das 15 cores da paleta.
 */
export function getContrastTextColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return '#FFFFFF';
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Fórmula YIQ para percepção de luminosidade
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 155 ? '#111827' : '#FFFFFF';
}

/**
 * Ordenação dentro do dia:
 * 1. Cards com horário aparecem primeiro, ordenados cronologicamente (ex: 08:00, 10:30, 14:00).
 * 2. Cards sem horário aparecem depois, em ordem estável por created_at.
 */
export function sortCardsForDay(cards: CalendarCard[]): CalendarCard[] {
  return [...cards].sort((a, b) => {
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    if (a.time && !b.time) {
      return -1;
    }
    if (!a.time && b.time) {
      return 1;
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

/**
 * Calcula dinamicamente a matriz completa de dias para a visão mensal.
 * Inicia a semana na segunda-feira (weekStartsOn: 1).
 */
export function getCalendarDays(currentDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return allDays.map((date) => ({
    date,
    dateString: format(date, 'yyyy-MM-dd'),
    dayOfMonth: date.getDate(),
    isCurrentMonth: isSameMonth(date, currentDate),
    isToday: isToday(date),
  }));
}

/**
 * Formata o título do período atual no mês (ex: "Setembro de 2026")
 */
export function formatCurrentPeriod(date: Date): string {
  const formatted = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Calcula os 7 dias da semana para a visão semanal.
 * Inicia na segunda-feira (weekStartsOn: 1) e termina no domingo.
 */
export function getWeekDays(currentDate: Date): CalendarDay[] {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return allDays.map((date) => ({
    date,
    dateString: format(date, 'yyyy-MM-dd'),
    dayOfMonth: date.getDate(),
    isCurrentMonth: isSameMonth(date, currentDate),
    isToday: isToday(date),
  }));
}

/**
 * Formata o título do período semanal de acordo com as regras de intersecção:
 * - Mesmo mês: "21 – 27 de setembro de 2026"
 * - Entre meses: "28 de setembro – 4 de outubro de 2026"
 * - Entre anos: "28 de dezembro de 2026 – 3 de janeiro de 2027"
 */
export function formatWeekPeriod(date: Date): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const startMonth = format(weekStart, 'MMMM', { locale: ptBR });
  const endMonth = format(weekEnd, 'MMMM', { locale: ptBR });
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();

  if (startYear !== endYear) {
    return `${startDay} de ${startMonth} de ${startYear} – ${endDay} de ${endMonth} de ${endYear}`;
  }

  if (weekStart.getMonth() !== weekEnd.getMonth()) {
    return `${startDay} de ${startMonth} – ${endDay} de ${endMonth} de ${startYear}`;
  }

  return `${startDay} – ${endDay} de ${startMonth} de ${startYear}`;
}

/**
 * Formata o título do período diário em pt-BR (ex: "Quarta-feira, 23 de setembro de 2026")
 */
export function formatDayPeriod(date: Date): string {
  const formatted = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Formata o título do período anual (ex: "2026")
 */
export function formatYearPeriod(date: Date): string {
  return date.getFullYear().toString();
}

