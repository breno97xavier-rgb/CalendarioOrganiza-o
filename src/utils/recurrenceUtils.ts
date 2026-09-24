import { CalendarCard, CalendarOccurrence, RecurrenceType, RecurrenceUnit } from '../types/calendar';

/**
 * Utilitários puros de manipulação de data sem timezone shift (YYYY-MM-DD)
 */
function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10), // 1-12
    day: parseInt(dayStr, 10),
  };
}

function formatDateParts(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, '0');
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna o número de dias de um determinado mês em um determinado ano
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Retorna o dia da semana no padrão ISO: 1 (segunda) a 7 (domingo)
 */
function getIsoDayOfWeek(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  const jsDay = new Date(year, month - 1, day).getDay(); // 0 = dom, 1 = seg, ... 6 = sab
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Adiciona N dias a uma data YYYY-MM-DD
 */
function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Calcula a diferença em dias entre duas datas (dateB - dateA)
 */
function diffDays(dateA: string, dateB: string): number {
  const pA = parseDateParts(dateA);
  const pB = parseDateParts(dateB);
  const tA = Date.UTC(pA.year, pA.month - 1, pA.day);
  const tB = Date.UTC(pB.year, pB.month - 1, pB.day);
  return Math.round((tB - tA) / (1000 * 60 * 60 * 24));
}

/**
 * Obtém a segunda-feira da semana de uma data
 */
function getMondayOfWeek(dateStr: string): string {
  const isoDay = getIsoDayOfWeek(dateStr);
  return addDays(dateStr, -(isoDay - 1));
}

/**
 * Retorna um resumo legível e amigável da recorrência de um card
 */
export function getRecurrenceSummary(card: CalendarCard): string {
  switch (card.recurrence_type) {
    case 'none':
      return 'Não se repete';
    case 'daily':
      return card.recurrence_interval === 1
        ? 'Todos os dias'
        : `A cada ${card.recurrence_interval} dias`;
    case 'weekly': {
      const dayNames = ['', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
      const baseDay = card.recurrence_days && card.recurrence_days.length > 0
        ? card.recurrence_days[0]
        : getIsoDayOfWeek(card.date);
      return `Toda ${dayNames[baseDay] || 'semana'}`;
    }
    case 'monthly':
      return card.recurrence_interval === 1
        ? 'Todo mês'
        : `A cada ${card.recurrence_interval} meses`;
    case 'custom': {
      const interval = card.recurrence_interval || 1;
      const unit = card.recurrence_unit;
      if (unit === 'day') {
        return interval === 1 ? 'A cada 1 dia' : `A cada ${interval} dias`;
      }
      if (unit === 'month') {
        return interval === 1 ? 'A cada 1 mês' : `A cada ${interval} meses`;
      }
      if (unit === 'week') {
        const shortDays = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        const days = (card.recurrence_days || []).map((d) => shortDays[d]).filter(Boolean).join(', ');
        const prefix = interval === 1 ? 'Toda semana' : `A cada ${interval} semanas`;
        return days ? `${prefix} (${days})` : prefix;
      }
      return 'Personalizada';
    }
    default:
      return 'Não se repete';
  }
}

/**
 * Motor de Expansão de Ocorrências Virtuais
 * 
 * Recebe os cards retornados do Supabase e calcula virtualmente as ocorrências
 * que caem estritamente dentro do intervalo visível [rangeStart, rangeEnd].
 * Não materializa nenhum registro no banco de dados.
 */
export function expandRecurringCards(
  cards: CalendarCard[],
  rangeStart: string,
  rangeEnd: string
): CalendarOccurrence[] {
  const occurrences: CalendarOccurrence[] = [];

  for (const card of cards) {
    // 1. Cards Não Recorrentes (none)
    if (card.recurrence_type === 'none') {
      if (card.date >= rangeStart && card.date <= rangeEnd) {
        occurrences.push({
          occurrenceKey: `${card.id}:${card.date}`,
          cardId: card.id,
          card,
          occurrenceDate: card.date,
          content: card.content,
          color: card.color,
          time: card.time,
          isRecurring: false,
        });
      }
      continue;
    }

    // 2. Cards Recorrentes
    // Limite final efetivo (inclusive)
    const effectiveEnd = card.recurrence_end_date && card.recurrence_end_date < rangeEnd
      ? card.recurrence_end_date
      : rangeEnd;

    // Se a data de início da série for posterior ao final do intervalo visível ou ao término da série
    if (card.date > effectiveEnd) {
      continue;
    }

    // A) Recorrência DIÁRIA (daily)
    if (card.recurrence_type === 'daily') {
      const interval = Math.max(1, card.recurrence_interval || 1);
      
      // Otimização: calcula o primeiro dia a testar dentro ou logo antes de rangeStart
      let current = card.date;
      if (current < rangeStart) {
        const daysDiff = diffDays(card.date, rangeStart);
        const steps = Math.ceil(daysDiff / interval);
        current = addDays(card.date, steps * interval);
      }

      while (current <= effectiveEnd) {
        if (current >= rangeStart && current >= card.date) {
          occurrences.push({
            occurrenceKey: `${card.id}:${current}`,
            cardId: card.id,
            card,
            occurrenceDate: current,
            content: card.content,
            color: card.color,
            time: card.time,
            isRecurring: true,
          });
        }
        current = addDays(current, interval);
      }
      continue;
    }

    // B) Recorrência SEMANAL (weekly)
    if (card.recurrence_type === 'weekly') {
      const interval = Math.max(1, card.recurrence_interval || 1);
      const targetDays = card.recurrence_days && card.recurrence_days.length > 0
        ? card.recurrence_days
        : [getIsoDayOfWeek(card.date)];

      const baseMonday = getMondayOfWeek(card.date);
      let weekMonday = getMondayOfWeek(rangeStart < card.date ? card.date : rangeStart);

      // Alinha weekMonday com o ciclo de semanas baseado em interval
      const weekDiff = Math.floor(diffDays(baseMonday, weekMonday) / 7);
      const remainder = ((weekDiff % interval) + interval) % interval;
      if (remainder !== 0) {
        weekMonday = addDays(weekMonday, (interval - remainder) * 7);
      }

      while (weekMonday <= effectiveEnd) {
        for (const dayOfWeek of targetDays) {
          const occDate = addDays(weekMonday, dayOfWeek - 1);
          if (occDate >= card.date && occDate >= rangeStart && occDate <= effectiveEnd) {
            occurrences.push({
              occurrenceKey: `${card.id}:${occDate}`,
              cardId: card.id,
              card,
              occurrenceDate: occDate,
              content: card.content,
              color: card.color,
              time: card.time,
              isRecurring: true,
            });
          }
        }
        weekMonday = addDays(weekMonday, interval * 7);
      }
      continue;
    }

    // C) Recorrência MENSAL (monthly)
    if (card.recurrence_type === 'monthly') {
      const interval = Math.max(1, card.recurrence_interval || 1);
      const { year: baseYear, month: baseMonth, day: baseDay } = parseDateParts(card.date);
      const { year: startYear, month: startMonth } = parseDateParts(rangeStart);
      const { year: endYear, month: endMonth } = parseDateParts(effectiveEnd);

      // Meses desde a data base
      const totalStartMonths = (startYear - baseYear) * 12 + (startMonth - baseMonth);
      let stepIndex = Math.max(0, Math.floor(totalStartMonths / interval) * interval);

      while (true) {
        const totalMonths = (baseMonth - 1) + stepIndex;
        const curYear = baseYear + Math.floor(totalMonths / 12);
        const curMonth = (totalMonths % 12) + 1;

        if (curYear > endYear || (curYear === endYear && curMonth > endMonth)) {
          break;
        }

        // REGRA DE DIAS INEXISTENTES: Se o mês não possuir o dia-base (ex: dia 31 em fev/abr), PULA
        const daysInCurMonth = getDaysInMonth(curYear, curMonth);
        if (baseDay <= daysInCurMonth) {
          const occDate = formatDateParts(curYear, curMonth, baseDay);
          if (occDate >= card.date && occDate >= rangeStart && occDate <= effectiveEnd) {
            occurrences.push({
              occurrenceKey: `${card.id}:${occDate}`,
              cardId: card.id,
              card,
              occurrenceDate: occDate,
              content: card.content,
              color: card.color,
              time: card.time,
              isRecurring: true,
            });
          }
        }

        stepIndex += interval;
      }
      continue;
    }

    // D) Recorrência PERSONALIZADA (custom)
    if (card.recurrence_type === 'custom') {
      const interval = Math.max(1, card.recurrence_interval || 1);
      const unit = card.recurrence_unit;

      // CUSTOM + DAY
      if (unit === 'day') {
        let current = card.date;
        if (current < rangeStart) {
          const daysDiff = diffDays(card.date, rangeStart);
          const steps = Math.ceil(daysDiff / interval);
          current = addDays(card.date, steps * interval);
        }

        while (current <= effectiveEnd) {
          if (current >= rangeStart && current >= card.date) {
            occurrences.push({
              occurrenceKey: `${card.id}:${current}`,
              cardId: card.id,
              card,
              occurrenceDate: current,
              content: card.content,
              color: card.color,
              time: card.time,
              isRecurring: true,
            });
          }
          current = addDays(current, interval);
        }
        continue;
      }

      // CUSTOM + WEEK
      if (unit === 'week') {
        const targetDays = card.recurrence_days && card.recurrence_days.length > 0
          ? card.recurrence_days
          : [getIsoDayOfWeek(card.date)];

        const baseMonday = getMondayOfWeek(card.date);
        let weekMonday = getMondayOfWeek(rangeStart < card.date ? card.date : rangeStart);

        const weekDiff = Math.floor(diffDays(baseMonday, weekMonday) / 7);
        const remainder = ((weekDiff % interval) + interval) % interval;
        if (remainder !== 0) {
          weekMonday = addDays(weekMonday, (interval - remainder) * 7);
        }

        while (weekMonday <= effectiveEnd) {
          for (const dayOfWeek of targetDays) {
            const occDate = addDays(weekMonday, dayOfWeek - 1);
            if (occDate >= card.date && occDate >= rangeStart && occDate <= effectiveEnd) {
              occurrences.push({
                occurrenceKey: `${card.id}:${occDate}`,
                cardId: card.id,
                card,
                occurrenceDate: occDate,
                content: card.content,
                color: card.color,
                time: card.time,
                isRecurring: true,
              });
            }
          }
          weekMonday = addDays(weekMonday, interval * 7);
        }
        continue;
      }

      // CUSTOM + MONTH
      if (unit === 'month') {
        const { year: baseYear, month: baseMonth, day: baseDay } = parseDateParts(card.date);
        const { year: startYear, month: startMonth } = parseDateParts(rangeStart);
        const { year: endYear, month: endMonth } = parseDateParts(effectiveEnd);

        const totalStartMonths = (startYear - baseYear) * 12 + (startMonth - baseMonth);
        let stepIndex = Math.max(0, Math.floor(totalStartMonths / interval) * interval);

        while (true) {
          const totalMonths = (baseMonth - 1) + stepIndex;
          const curYear = baseYear + Math.floor(totalMonths / 12);
          const curMonth = (totalMonths % 12) + 1;

          if (curYear > endYear || (curYear === endYear && curMonth > endMonth)) {
            break;
          }

          const daysInCurMonth = getDaysInMonth(curYear, curMonth);
          if (baseDay <= daysInCurMonth) {
            const occDate = formatDateParts(curYear, curMonth, baseDay);
            if (occDate >= card.date && occDate >= rangeStart && occDate <= effectiveEnd) {
              occurrences.push({
                occurrenceKey: `${card.id}:${occDate}`,
                cardId: card.id,
                card,
                occurrenceDate: occDate,
                content: card.content,
                color: card.color,
                time: card.time,
                isRecurring: true,
              });
            }
          }

          stepIndex += interval;
        }
        continue;
      }
    }
  }

  return occurrences;
}

/**
 * Ordenação dentro do dia para ocorrências virtuais:
 * 1. Ocorrências com horário aparecem primeiro, ordenadas cronologicamente.
 * 2. Ocorrências sem horário aparecem depois, em ordem estável por created_at / cardId.
 */
export function sortOccurrencesForDay(occurrences: CalendarOccurrence[]): CalendarOccurrence[] {
  return [...occurrences].sort((a, b) => {
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    if (a.time && !b.time) {
      return -1;
    }
    if (!a.time && b.time) {
      return 1;
    }
    return a.card.created_at.localeCompare(b.card.created_at);
  });
}
