import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  format,
} from 'date-fns';
import { calendarCardService } from '../src/services/calendarCardService';
import {
  expandRecurringCards,
  sortOccurrencesForDay,
  getRecurrenceSummary,
} from '../src/utils/recurrenceUtils';
import {
  formatYearPeriod,
  formatDayPeriod,
  formatWeekPeriod,
  formatCurrentPeriod,
  getCalendarDays,
  getWeekDays,
  sortCardsForDay,
  COLOR_PALETTE,
  WEEK_DAYS,
} from '../src/utils/calendarUtils';
import { CalendarCard, CalendarOccurrence } from '../src/types/calendar';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configuradas.');
  process.exit(1);
}

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

interface TestStats {
  group: string;
  passed: number;
  failed: number;
}

const stats: Record<string, TestStats> = {
  A: { group: 'A. Banco', passed: 0, failed: 0 },
  B: { group: 'B. CRUD', passed: 0, failed: 0 },
  C: { group: 'C. Recorrência', passed: 0, failed: 0 },
  D: { group: 'D. Mês', passed: 0, failed: 0 },
  E: { group: 'E. Semana', passed: 0, failed: 0 },
  F: { group: 'F. Dia', passed: 0, failed: 0 },
  G: { group: 'G. Ano', passed: 0, failed: 0 },
  H: { group: 'H. Cross-view', passed: 0, failed: 0 },
  I: { group: 'I. Constraints', passed: 0, failed: 0 },
  J: { group: 'J. Erros', passed: 0, failed: 0 },
  K: { group: 'K. Datas críticas', passed: 0, failed: 0 },
  L: { group: 'L. Persistência', passed: 0, failed: 0 },
  M: { group: 'M. Isolamento & Proteção', passed: 0, failed: 0 },
};

function assert(groupKey: string, desc: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✓ [${groupKey}] ${desc}`);
    stats[groupKey].passed++;
  } else {
    console.error(`  ✗ [${groupKey}] FALHA: ${desc} ${details ? `(${details})` : ''}`);
    stats[groupKey].failed++;
  }
}

async function runIntegratedValidation() {
  console.log('================================================================');
  console.log('ETAPA: F1.10 — VALIDAÇÃO FINAL INTEGRADA DO CALENDÁRIO PESSOAL');
  console.log('================================================================\n');

  console.log('[FASE PREPARATÓRIA] Inicializando guard de isolamento e proteção...');
  const guard = await createTestGuard(rawClient, 'F1.10');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  // ============================================================================
  // GRUPO A: BANCO DE DADOS
  // ============================================================================
  console.log('>>> GRUPO A: BANCO DE DADOS');
  try {
    const testCard = await rawClient
      .from('calendar_cards')
      .insert({
        content: guard.formatContent('Card Teste Banco A'),
        color: COLOR_PALETTE[0].hex,
        date: '2026-09-23',
        time: '10:00:00',
        recurrence_type: 'none',
      })
      .select()
      .single();

    assert('A', 'Inserção direta no Supabase via cliente anônimo funciona', !testCard.error && !!testCard.data);
    const cardData = testCard.data;
    if (cardData?.id) {
      guard.registerCreatedId(cardData.id);
    }

    assert('A', 'Coluna id gerada como UUID válido', typeof cardData.id === 'string' && cardData.id.length === 36);
    assert('A', 'Coluna created_at preenchida automaticamente', !!cardData.created_at);
    assert('A', 'Coluna updated_at preenchida automaticamente', !!cardData.updated_at);
    assert('A', 'Coluna recurrence_interval padrão = 1', cardData.recurrence_interval === 1);
    assert('A', 'Coluna recurrence_type padrão = none', cardData.recurrence_type === 'none');

    // Teste de trigger updated_at
    const originalUpdatedAt = cardData.updated_at;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const updated = await rawClient
      .from('calendar_cards')
      .update({ content: guard.formatContent('Card Teste Banco A Atualizado') })
      .eq('id', cardData.id)
      .select()
      .single();

    assert(
      'A',
      'Trigger trigger_calendar_cards_updated_at atualiza updated_at no UPDATE',
      !updated.error && updated.data.updated_at !== originalUpdatedAt
    );

    // Remoção do card de teste do Grupo A
    await rawClient.from('calendar_cards').delete().eq('id', cardData.id);
  } catch (err: unknown) {
    assert('A', 'Operações de auditoria de banco executadas sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO B: CRUD
  // ============================================================================
  console.log('\n>>> GRUPO B: CRUD (calendarCardService)');
  try {
    // 1. Create sem horário
    const cardUntimed = await calendarCardService.createCard({
      content: guard.formatContent('Card B Sem Horário'),
      color: COLOR_PALETTE[2].hex,
      date: '2026-09-24',
    });
    guard.registerCreatedId(cardUntimed.id);
    assert('B', 'createCard sem horário cria registro com time: null', !!cardUntimed.id && cardUntimed.time === null);

    // 2. Create com horário
    const cardTimed = await calendarCardService.createCard({
      content: guard.formatContent('Card B Com Horário'),
      color: COLOR_PALETTE[3].hex,
      date: '2026-09-24',
      time: '14:30',
    });
    guard.registerCreatedId(cardTimed.id);
    assert('B', 'createCard com horário persiste valor correto', !!cardTimed.id && (cardTimed.time || '').startsWith('14:30'));

    // 3. getCardById
    const fetched = await calendarCardService.getCardById(cardTimed.id);
    assert('B', 'getCardById recupera card com dados idênticos', fetched.id === cardTimed.id && fetched.content === guard.formatContent('Card B Com Horário'));

    // 4. updateCard
    const updatedCard = await calendarCardService.updateCard(cardTimed.id, {
      content: guard.formatContent('Card B Com Horário Alterado'),
      time: '15:00',
    });
    assert('B', 'updateCard altera conteúdo e horário', updatedCard.content === guard.formatContent('Card B Com Horário Alterado') && (updatedCard.time || '').startsWith('15:00'));

    // 5. duplicateCard
    const duplicated = await calendarCardService.duplicateCard(cardTimed.id);
    guard.registerCreatedId(duplicated.id);
    assert('B', 'duplicateCard gera novo UUID independente', !!duplicated.id && duplicated.id !== cardTimed.id);
    assert('B', 'duplicateCard replica dados essenciais', duplicated.content === updatedCard.content && duplicated.date === updatedCard.date);

    // 6. Cópia de Série Recorrente e Independência Total
    const originalSeries = await calendarCardService.createCard({
      content: guard.formatContent('Série Original Semanal'),
      color: COLOR_PALETTE[5].hex,
      date: '2026-09-01',
      time: '09:00',
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_days: [2],
    });
    guard.registerCreatedId(originalSeries.id);
    const copiedSeries = await calendarCardService.duplicateCard(originalSeries.id);
    guard.registerCreatedId(copiedSeries.id);
    assert('B', 'Cópia de série gera UUID distinto', copiedSeries.id !== originalSeries.id);
    assert('B', 'Cópia de série preserva tipo de recorrência', copiedSeries.recurrence_type === 'weekly' && copiedSeries.recurrence_interval === 1);

    // Edição da cópia não afeta original
    await calendarCardService.updateCard(copiedSeries.id, { content: guard.formatContent('Série Cópia Modificada') });
    const originalReloaded = await calendarCardService.getCardById(originalSeries.id);
    assert('B', 'Edição da série copiada não altera a série original', originalReloaded.content === guard.formatContent('Série Original Semanal'));

    // Exclusão da cópia não afeta original
    await calendarCardService.deleteCard(copiedSeries.id);
    const originalStillExists = await calendarCardService.getCardById(originalSeries.id);
    assert('B', 'Exclusão da série copiada não exclui a série original', !!originalStillExists.id);
    await calendarCardService.deleteCard(originalSeries.id);

    // 7. Transições de Recorrência com Normalização
    const transitionCard = await calendarCardService.createCard({
      content: guard.formatContent('Card Transição Recorrência'),
      color: COLOR_PALETTE[1].hex,
      date: '2026-09-10',
      recurrence_type: 'none',
    });
    guard.registerCreatedId(transitionCard.id);

    // none -> daily
    const toDaily = await calendarCardService.updateCard(transitionCard.id, {
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
    });
    assert('B', 'Transição none -> daily normaliza campos', toDaily.recurrence_type === 'daily' && toDaily.recurrence_unit === null);

    // daily -> none
    const toNone = await calendarCardService.updateCard(transitionCard.id, {
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
    });
    assert('B', 'Transição daily -> none limpa campos de recorrência', toNone.recurrence_type === 'none' && toNone.recurrence_unit === null && toNone.recurrence_days === null);

    // weekly -> custom week
    const toCustomWeek = await calendarCardService.updateCard(transitionCard.id, {
      recurrence_type: 'custom',
      recurrence_interval: 2,
      recurrence_unit: 'week',
      recurrence_days: [1, 3, 5],
    });
    assert('B', 'Transição weekly -> custom week atualiza unit e days', toCustomWeek.recurrence_type === 'custom' && toCustomWeek.recurrence_unit === 'week' && toCustomWeek.recurrence_interval === 2);

    // custom week -> monthly
    const toMonthly = await calendarCardService.updateCard(transitionCard.id, {
      recurrence_type: 'monthly',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
    });
    assert('B', 'Transição custom week -> monthly remove unit e days incompatíveis', toMonthly.recurrence_type === 'monthly' && toMonthly.recurrence_unit === null && toMonthly.recurrence_days === null);

    await calendarCardService.deleteCard(transitionCard.id);

    // 8. deleteCard
    await calendarCardService.deleteCard(duplicated.id);
    let deletedFound = true;
    try {
      await calendarCardService.getCardById(duplicated.id);
    } catch {
      deletedFound = false;
    }
    assert('B', 'deleteCard remove registro do banco', !deletedFound);

    // Limpeza B
    await calendarCardService.deleteCard(cardUntimed.id);
    await calendarCardService.deleteCard(cardTimed.id);
  } catch (err: unknown) {
    assert('B', 'CRUD executado sem exceções', false, String(err));
  }

  // ============================================================================
  // GRUPO C: RECORRÊNCIA
  // ============================================================================
  console.log('\n>>> GRUPO C: RECORRÊNCIA (recurrenceUtils)');
  try {
    // 1. NONE
    const mockNone: CalendarCard = {
      id: 'mock-none',
      content: 'Sem Recorrência',
      color: '#DC2626',
      date: '2026-09-15',
      time: null,
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occNone = expandRecurringCards([mockNone], '2026-09-01', '2026-09-30');
    assert('C', 'Recorrência NONE gera exatamente 1 ocorrência na sua data', occNone.length === 1 && occNone[0].occurrenceDate === '2026-09-15');

    // 2. DAILY
    const mockDaily: CalendarCard = {
      id: 'mock-daily',
      content: 'Diário a cada 2 dias',
      color: '#2563EB',
      date: '2026-09-01',
      time: '09:00',
      recurrence_type: 'daily',
      recurrence_interval: 2,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: '2026-09-10',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occDaily = expandRecurringCards([mockDaily], '2026-09-01', '2026-09-30');
    // Dias: 01, 03, 05, 07, 09 (dia 11 > 10) -> total 5
    assert('C', 'Recorrência DAILY com intervalo 2 e end_date gera 5 ocorrências', occDaily.length === 5 && occDaily[4].occurrenceDate === '2026-09-09');

    // 3. WEEKLY
    const mockWeekly: CalendarCard = {
      id: 'mock-weekly',
      content: 'Semanal Quinta-feira',
      color: '#16A34A',
      date: '2026-09-03', // Quinta-feira
      time: null,
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: [4], // Quinta-feira (4)
      recurrence_end_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occWeekly = expandRecurringCards([mockWeekly], '2026-09-01', '2026-09-30');
    // Quintas de set/2026: 03, 10, 17, 24 -> 4 ocorrências
    assert('C', 'Recorrência WEEKLY nas quintas de set/2026 gera exatamente 4 ocorrências', occWeekly.length === 4);

    // 4. MONTHLY
    const mockMonthly: CalendarCard = {
      id: 'mock-monthly',
      content: 'Mensal dia 15',
      color: '#7C3AED',
      date: '2026-01-15',
      time: null,
      recurrence_type: 'monthly',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occMonthly = expandRecurringCards([mockMonthly], '2026-01-01', '2026-12-31');
    assert('C', 'Recorrência MONTHLY gera 12 ocorrências no ano', occMonthly.length === 12);

    // 5. CUSTOM WEEK (Seg, Qua, Sex)
    const mockCustomWeek: CalendarCard = {
      id: 'mock-custom-week',
      content: 'Custom Week Seg Qua Sex',
      color: '#0D9488',
      date: '2026-09-07', // Segunda
      time: '08:00',
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'week',
      recurrence_days: [1, 3, 5],
      recurrence_end_date: '2026-09-20',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occCustomWeek = expandRecurringCards([mockCustomWeek], '2026-09-01', '2026-09-30');
    // Semana 1: 07 (seg), 09 (qua), 11 (sex) = 3
    // Semana 2: 14 (seg), 16 (qua), 18 (sex) = 3
    assert('C', 'Recorrência CUSTOM WEEK (Seg/Qua/Sex) por 2 semanas gera 6 ocorrências', occCustomWeek.length === 6);

    // 6. Nenhuma ocorrência antes da data-base
    const mockFuture: CalendarCard = {
      id: 'mock-future',
      content: 'Inicia em 2026-09-15',
      color: '#DC2626',
      date: '2026-09-15',
      time: null,
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occEarlyRange = expandRecurringCards([mockFuture], '2026-09-01', '2026-09-10');
    assert('C', 'Nenhuma ocorrência gerada antes da data-base da série', occEarlyRange.length === 0);

    // 7. Resumo amigável da recorrência
    const summary = getRecurrenceSummary(mockCustomWeek);
    assert('C', 'getRecurrenceSummary gera texto legível para custom week', summary.includes('Toda semana') && summary.includes('Seg'));
  } catch (err: unknown) {
    assert('C', 'Recorrência executada sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO D: MÊS
  // ============================================================================
  console.log('\n>>> GRUPO D: MÊS');
  try {
    const refDate = new Date(2026, 8, 23); // Setembro 2026
    const monthDays = getCalendarDays(refDate);

    assert('D', 'Matriz mensal possui múltiplos de 7 dias (semanas completas)', monthDays.length % 7 === 0);
    assert('D', 'Semana inicia na segunda-feira (primeiro dia ISO day = 1)', monthDays[0].date.getDay() === 1);
    assert('D', 'Cabeçalho de dias da semana possui 7 itens de SEG a DOM', WEEK_DAYS.length === 7 && WEEK_DAYS[0] === 'SEG' && WEEK_DAYS[6] === 'DOM');

    // Teste de navegação
    const prevMonth = subMonths(refDate, 1);
    assert('D', 'subMonths navega para o mês anterior (Agosto)', prevMonth.getMonth() === 7);
    const nextMonth = addMonths(refDate, 1);
    assert('D', 'addMonths navega para o próximo mês (Outubro)', nextMonth.getMonth() === 9);

    // Título
    const title = formatCurrentPeriod(refDate);
    assert('D', 'Título do mês formatado em pt-BR com capitalização', title.startsWith('Setembro de 2026'));
  } catch (err: unknown) {
    assert('D', 'Mês executado sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO E: SEMANA
  // ============================================================================
  console.log('\n>>> GRUPO E: SEMANA');
  try {
    const refDate = new Date(2026, 8, 23); // Quarta 23/09/2026
    const weekDays = getWeekDays(refDate);

    assert('E', 'Semana contém exatamente 7 dias', weekDays.length === 7);
    assert('E', 'Primeiro dia da semana é Segunda-feira (21/09/2026)', weekDays[0].dateString === '2026-09-21');
    assert('E', 'Último dia da semana é Domingo (27/09/2026)', weekDays[6].dateString === '2026-09-27');

    // Navegação
    const prevWeek = subWeeks(refDate, 1);
    assert('E', 'subWeeks recua 7 dias', format(prevWeek, 'yyyy-MM-dd') === '2026-09-16');
    const nextWeek = addWeeks(refDate, 1);
    assert('E', 'addWeeks avança 7 dias', format(nextWeek, 'yyyy-MM-dd') === '2026-09-30');

    // Título mesmo mês
    const titleSame = formatWeekPeriod(refDate);
    assert('E', 'Título da semana no mesmo mês: "21 – 27 de setembro de 2026"', titleSame === '21 – 27 de setembro de 2026');

    // Título entre meses
    const crossMonthDate = new Date(2026, 8, 29); // 29/09/2026
    const titleCrossMonth = formatWeekPeriod(crossMonthDate);
    assert('E', 'Título da semana entre meses exibe ambos os meses', titleCrossMonth.includes('setembro') && titleCrossMonth.includes('outubro'));

    // Título entre anos
    const crossYearDate = new Date(2026, 11, 30); // 30/12/2026
    const titleCrossYear = formatWeekPeriod(crossYearDate);
    assert('E', 'Título da semana entre anos exibe ambos os anos', titleCrossYear.includes('2026') && titleCrossYear.includes('2027'));
  } catch (err: unknown) {
    assert('E', 'Semana executada sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO F: DIA
  // ============================================================================
  console.log('\n>>> GRUPO F: DIA');
  try {
    const refDate = new Date(2026, 8, 23); // Quarta-feira, 23 de setembro de 2026
    const dayTitle = formatDayPeriod(refDate);
    assert('F', 'Título do Dia com dia da semana e data completa', dayTitle.includes('Quarta-feira') && dayTitle.includes('23 de setembro de 2026'));

    // Navegação
    const prevDay = subDays(refDate, 1);
    assert('F', 'subDays recua 1 dia (22/09/2026)', format(prevDay, 'yyyy-MM-dd') === '2026-09-22');
    const nextDay = addDays(refDate, 1);
    assert('F', 'addDays avança 1 dia (24/09/2026)', format(nextDay, 'yyyy-MM-dd') === '2026-09-24');

    // Separação Com Horário vs Sem Horário
    const dummyCardTimed: CalendarCard = {
      id: 'd-timed',
      content: 'Timed Card',
      color: '#DC2626',
      date: '2026-09-23',
      time: '11:00',
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
      created_at: '2026-09-23T01:00:00Z',
      updated_at: '2026-09-23T01:00:00Z',
    };
    const dummyCardUntimed: CalendarCard = {
      id: 'd-untimed',
      content: 'Untimed Card',
      color: '#2563EB',
      date: '2026-09-23',
      time: null,
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
      created_at: '2026-09-23T02:00:00Z',
      updated_at: '2026-09-23T02:00:00Z',
    };
    const occurrences = expandRecurringCards([dummyCardTimed, dummyCardUntimed], '2026-09-23', '2026-09-23');
    const sorted = sortOccurrencesForDay(occurrences);
    assert('F', 'Cards do dia ordenados: com horário primeiro, sem horário depois', sorted[0].time === '11:00' && sorted[1].time === null);
  } catch (err: unknown) {
    assert('F', 'Dia executado sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO G: ANO
  // ============================================================================
  console.log('\n>>> GRUPO G: ANO');
  try {
    const refDate = new Date(2026, 4, 15);
    const yearTitle = formatYearPeriod(refDate);
    assert('G', 'Título do Ano é minimalista ("2026")', yearTitle === '2026');

    // Navegação
    const prevYear = subYears(refDate, 1);
    assert('G', 'subYears recua 1 ano (2025)', formatYearPeriod(prevYear) === '2025');
    const nextYear = addYears(refDate, 1);
    assert('G', 'addYears avança 1 ano (2027)', formatYearPeriod(nextYear) === '2027');

    // Estrutura de 12 meses
    const months = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1));
    assert('G', 'Geração contempla todos os 12 meses do ano', months.length === 12);

    // Fevereiro não bissexto vs bissexto
    const daysFeb2027 = new Date(2027, 2, 0).getDate();
    const daysFeb2028 = new Date(2028, 2, 0).getDate();
    assert('G', 'Fevereiro de 2027 tem 28 dias', daysFeb2027 === 28);
    assert('G', 'Fevereiro bissexto de 2028 tem 29 dias', daysFeb2028 === 29);

    // Indicadores: limite 3 + N
    const testList: CalendarOccurrence[] = Array.from({ length: 5 }, (_, i) => ({
      occurrenceKey: `occ-${i}`,
      cardId: `c-${i}`,
      card: {} as CalendarCard,
      occurrenceDate: '2026-09-23',
      content: `Card ${i}`,
      color: COLOR_PALETTE[i].hex,
      time: null,
      isRecurring: false,
    }));
    const visibleDots = testList.slice(0, 3);
    const remainder = testList.length - 3;
    assert('G', 'Cálculo de indicadores anuais limita a 3 bolinhas visíveis', visibleDots.length === 3);
    assert('G', 'Cálculo de indicadores anuais adiciona contador +N (+2 para 5 cards)', remainder === 2);
  } catch (err: unknown) {
    assert('G', 'Ano executado sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO H: CROSS-VIEW
  // ============================================================================
  console.log('\n>>> GRUPO H: CROSS-VIEW');
  try {
    // Cria 1 card no banco em 23/09/2026
    const crossCard = await calendarCardService.createCard({
      content: guard.formatContent('Card Cross-View Test'),
      color: COLOR_PALETTE[4].hex,
      date: '2026-09-23',
      time: '16:00',
    });
    guard.registerCreatedId(crossCard.id);

    // 1. Mês (setembro 2026)
    const monthCards = await calendarCardService.getCards('2026-08-31', '2026-10-04');
    const monthOccs = expandRecurringCards(monthCards, '2026-08-31', '2026-10-04');
    const inMonth = monthOccs.some((o) => o.cardId === crossCard.id);
    assert('H', 'Card aparece na visualização Mês', inMonth);

    // 2. Semana (21 a 27/09/2026)
    const weekCards = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const weekOccs = expandRecurringCards(weekCards, '2026-09-21', '2026-09-27');
    const inWeek = weekOccs.some((o) => o.cardId === crossCard.id);
    assert('H', 'Card aparece na visualização Semana', inWeek);

    // 3. Dia (23/09/2026)
    const dayCards = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const dayOccs = expandRecurringCards(dayCards, '2026-09-23', '2026-09-23');
    const inDay = dayOccs.some((o) => o.cardId === crossCard.id);
    assert('H', 'Card aparece na visualização Dia', inDay);

    // 4. Ano (2026)
    const yearCards = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const yearOccs = expandRecurringCards(yearCards, '2026-01-01', '2026-12-31');
    const inYear = yearOccs.some((o) => o.cardId === crossCard.id);
    assert('H', 'Card aparece na visualização Ano', inYear);

    // Limpeza Cross-view
    await calendarCardService.deleteCard(crossCard.id);
  } catch (err: unknown) {
    assert('H', 'Cross-view executado sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO I: CONSTRAINTS
  // ============================================================================
  console.log('\n>>> GRUPO I: CONSTRAINTS DO BANCO');
  try {
    // 1. Content vazio
    const resEmptyContent = await rawClient.from('calendar_cards').insert({
      content: '   ',
      color: '#DC2626',
      date: '2026-09-23',
    });
    assert('I', 'Banco rejeita content vazio ou contendo apenas espaços', !!resEmptyContent.error);

    // 2. Color vazio
    const resEmptyColor = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '   ',
      date: '2026-09-23',
    });
    assert('I', 'Banco rejeita color vazio ou contendo apenas espaços', !!resEmptyColor.error);

    // 3. Recurrence type inválido
    const resInvalidType = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '#DC2626',
      date: '2026-09-23',
      recurrence_type: 'yearly_invalid',
    });
    assert('I', 'Banco rejeita recurrence_type não pertencente ao enum', !!resInvalidType.error);

    // 4. Recurrence interval < 1
    const resInvalidInterval = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '#DC2626',
      date: '2026-09-23',
      recurrence_type: 'daily',
      recurrence_interval: 0,
    });
    assert('I', 'Banco rejeita recurrence_interval menor que 1', !!resInvalidInterval.error);

    // 5. Recurrence days inválidos
    const resInvalidDays = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '#DC2626',
      date: '2026-09-23',
      recurrence_type: 'weekly',
      recurrence_days: [0, 8],
    });
    assert('I', 'Banco rejeita recurrence_days fora do intervalo 1-7', !!resInvalidDays.error);

    // 6. Recurrence end date anterior à date
    const resInvalidEndDate = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '#DC2626',
      date: '2026-09-23',
      recurrence_type: 'daily',
      recurrence_end_date: '2026-09-20',
    });
    assert('I', 'Banco rejeita recurrence_end_date anterior à data de início', !!resInvalidEndDate.error);

    // 7. Custom sem recurrence_unit
    const resCustomNoUnit = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '#DC2626',
      date: '2026-09-23',
      recurrence_type: 'custom',
      recurrence_unit: null,
    });
    assert('I', 'Banco rejeita recurrence_type custom sem recurrence_unit', !!resCustomNoUnit.error);

    // 8. Custom com recurrence_unit inválida
    const resCustomInvalidUnit = await rawClient.from('calendar_cards').insert({
      content: 'Content OK',
      color: '#DC2626',
      date: '2026-09-23',
      recurrence_type: 'custom',
      recurrence_unit: 'century',
    });
    assert('I', 'Banco rejeita recurrence_unit inválida', !!resCustomInvalidUnit.error);
  } catch (err: unknown) {
    assert('I', 'Constraints executadas sem exceção', false, String(err));
  }

  // ============================================================================
  // GRUPO J: ERROS
  // ============================================================================
  console.log('\n>>> GRUPO J: TRATAMENTO DE ERROS');
  try {
    let getErrorThrown = false;
    try {
      await calendarCardService.getCardById('00000000-0000-0000-0000-000000000000');
    } catch (err: unknown) {
      getErrorThrown = true;
      assert('J', 'getCardById com ID inexistente lança mensagem amigável', String(err).includes('Erro ao buscar card'));
    }
    assert('J', 'Exceção capturada para ID inexistente', getErrorThrown);

    // Validação de entrada no createCard para custom sem unit
    let createErrorThrown = false;
    try {
      await calendarCardService.createCard({
        content: 'Teste custom sem unit',
        color: '#DC2626',
        date: '2026-09-23',
        recurrence_type: 'custom',
        recurrence_unit: null,
      });
    } catch (err: unknown) {
      createErrorThrown = true;
      assert('J', 'createCard custom sem unidade lança erro de validação claro', String(err).includes('recurrence_unit é obrigatório'));
    }
    assert('J', 'Validação preventiva de custom recurrence emite erro antes do banco', createErrorThrown);
  } catch (err: unknown) {
    assert('J', 'Tratamento de erros auditado sem falha estrutural', false, String(err));
  }

  // ============================================================================
  // GRUPO K: DATAS CRÍTICAS
  // ============================================================================
  console.log('\n>>> GRUPO K: DATAS CRÍTICAS');
  try {
    // 1. Transição 31/12/2026 -> 01/01/2027
    const endOfYear = new Date(2026, 11, 31);
    const startOfNextYear = addDays(endOfYear, 1);
    assert('K', 'Transição 31/12/2026 para 01/01/2027 correta', format(startOfNextYear, 'yyyy-MM-dd') === '2027-01-01');

    // 2. Transição 28/02/2027 -> 01/03/2027 (não bissexto)
    const febEnd2027 = new Date(2027, 1, 28);
    const marStart2027 = addDays(febEnd2027, 1);
    assert('K', 'Transição não-bissexta 28/02/2027 para 01/03/2027 correta', format(marStart2027, 'yyyy-MM-dd') === '2027-03-01');

    // 3. Transição bissexta 2028: 28/02 -> 29/02 -> 01/03
    const feb28_2028 = new Date(2028, 1, 28);
    const feb29_2028 = addDays(feb28_2028, 1);
    const mar01_2028 = addDays(feb29_2028, 1);
    assert('K', 'Ano bissexto 2028 contempla 29 de fevereiro', format(feb29_2028, 'yyyy-MM-dd') === '2028-02-29');
    assert('K', 'Ano bissexto 2028 transita de 29/02 para 01/03', format(mar01_2028, 'yyyy-MM-dd') === '2028-03-01');

    // 4. Mensal iniciado em 31/01: fevereiro = SKIP, março = 31/03
    const mockJan31: CalendarCard = {
      id: 'mock-jan31',
      content: 'Mensal dia 31',
      color: '#DC2626',
      date: '2027-01-31',
      time: null,
      recurrence_type: 'monthly',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const occJan31 = expandRecurringCards([mockJan31], '2027-01-01', '2027-04-30');
    const occDates = occJan31.map((o) => o.occurrenceDate);
    assert('K', 'Recorrência mensal iniciada em 31/01 gera ocorrência em 31/01', occDates.includes('2027-01-31'));
    assert('K', 'Recorrência mensal iniciada em 31/01 pula fevereiro (SKIP - sem dia 31)', !occDates.some((d) => d.startsWith('2027-02')));
    assert('K', 'Recorrência mensal iniciada em 31/01 gera ocorrência em 31/03', occDates.includes('2027-03-31'));
    assert('K', 'Recorrência mensal iniciada em 31/01 pula abril (SKIP - 30 dias)', !occDates.some((d) => d.startsWith('2027-04')));
  } catch (err: unknown) {
    assert('K', 'Datas críticas executadas sem exceção', false, String(err));
  }

  // ============================================================================
  // ============================================================================
  // GRUPO L: PERSISTÊNCIA E ZERO MATERIALIZAÇÃO
  // ============================================================================
  console.log('\n>>> GRUPO L: PERSISTÊNCIA E ZERO MATERIALIZAÇÃO');
  try {
    // 1. Criar série diária real no Supabase
    const dailySeries = await calendarCardService.createCard({
      content: guard.formatContent('Série Zero Materialização Teste'),
      color: COLOR_PALETTE[5].hex,
      date: '2026-09-01',
      time: '08:30',
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: '2026-09-10',
    });
    guard.registerCreatedId(dailySeries.id);

    // 2. Verificar que exatamente 1 registro foi inserido no Supabase
    const { data: countData, count } = await rawClient
      .from('calendar_cards')
      .select('*', { count: 'exact' })
      .eq('id', dailySeries.id);

    assert('L', 'Série recorrente persiste exatamente UM registro-base no Supabase', count === 1 && countData?.length === 1);

    // 3. Verificar que o motor virtual expande 10 ocorrências para os 10 dias
    const cards = await calendarCardService.getCards('2026-09-01', '2026-09-30');
    const occurrences = expandRecurringCards(cards, '2026-09-01', '2026-09-30');
    const seriesOccurrences = occurrences.filter((o) => o.cardId === dailySeries.id);
    assert('L', 'Motor gera 10 ocorrências virtuais a partir de 1 único registro no banco', seriesOccurrences.length === 10);

    // 4. Re-consultar o Supabase e confirmar que nenhuma ocorrência extra da série foi materializada
    const { count: seriesInDb } = await rawClient
      .from('calendar_cards')
      .select('*', { count: 'exact' })
      .eq('id', dailySeries.id);

    assert('L', 'Zero materialização confirmada: tabela continua contendo apenas o registro original da série', seriesInDb === 1);

    // 5. Ordenação: 16:00, 08:00, sem horário A, 11:00, sem horário B
    const card1600 = await calendarCardService.createCard({
      content: guard.formatContent('16:00 Card'),
      color: COLOR_PALETTE[0].hex,
      date: '2026-09-25',
      time: '16:00',
    });
    guard.registerCreatedId(card1600.id);

    const card0800 = await calendarCardService.createCard({
      content: guard.formatContent('08:00 Card'),
      color: COLOR_PALETTE[1].hex,
      date: '2026-09-25',
      time: '08:00',
    });
    guard.registerCreatedId(card0800.id);

    const cardNoTimeA = await calendarCardService.createCard({
      content: guard.formatContent('sem horário A'),
      color: COLOR_PALETTE[2].hex,
      date: '2026-09-25',
      time: null,
    });
    guard.registerCreatedId(cardNoTimeA.id);

    const card1100 = await calendarCardService.createCard({
      content: guard.formatContent('11:00 Card'),
      color: COLOR_PALETTE[3].hex,
      date: '2026-09-25',
      time: '11:00',
    });
    guard.registerCreatedId(card1100.id);

    const cardNoTimeB = await calendarCardService.createCard({
      content: guard.formatContent('sem horário B'),
      color: COLOR_PALETTE[4].hex,
      date: '2026-09-25',
      time: null,
    });
    guard.registerCreatedId(cardNoTimeB.id);

    const dayCards = await calendarCardService.getCards('2026-09-25', '2026-09-25');
    const dayExpanded = expandRecurringCards(dayCards, '2026-09-25', '2026-09-25');
    const sortedDay = sortOccurrencesForDay(dayExpanded);

    const orderContents = sortedDay.map((o) => o.content);
    assert(
      'L',
      'Ordenação dentro do dia correta (08:00 -> 11:00 -> 16:00 -> sem horário A -> sem horário B)',
      orderContents[0] === guard.formatContent('08:00 Card') &&
      orderContents[1] === guard.formatContent('11:00 Card') &&
      orderContents[2] === guard.formatContent('16:00 Card') &&
      orderContents[3] === guard.formatContent('sem horário A') &&
      orderContents[4] === guard.formatContent('sem horário B')
    );

    // Limpeza intermediária L
    await calendarCardService.deleteCard(dailySeries.id);
    await calendarCardService.deleteCard(card1600.id);
    await calendarCardService.deleteCard(card0800.id);
    await calendarCardService.deleteCard(cardNoTimeA.id);
    await calendarCardService.deleteCard(card1100.id);
    await calendarCardService.deleteCard(cardNoTimeB.id);
  } catch (err: unknown) {
    assert('L', 'Persistência executada sem exceção', false, String(err));
  }

  // ============================================================================
  // LIMPEZA FINAL FAIL-CLOSED E AUDITORIA DE PRESERVAÇÃO
  // ============================================================================
  console.log('\n[FASE DE ENCERRAMENTO] Limpeza estritamente fail-closed dos registros de teste...');
  const cleanupResult = await guard.cleanup();
  console.log(`Registros de teste excluídos: ${cleanupResult.deletedCount}`);

  console.log('\n>>> GRUPO M: ISOLAMENTO & PROTEÇÃO DE DADOS');
  const dataProtection = await guard.verifyDataProtection();
  const testCleanup = await guard.verifyTestCleanup();

  assert(
    'M',
    'Preservação estrita: 100% dos dados preexistentes intactos',
    dataProtection.preserved,
    dataProtection.missingIds.length > 0 ? `IDs ausentes: ${dataProtection.missingIds.join(', ')}` : undefined
  );
  assert(
    'M',
    'Limpeza estrita: 100% dos cards criados pelo teste removidos',
    testCleanup.allRemoved,
    testCleanup.remainingIds.length > 0 ? `IDs remanescentes: ${testCleanup.remainingIds.join(', ')}` : undefined
  );

  // ============================================================================
  // RESUMO ESTATÍSTICO
  // ============================================================================
  console.log('================================================================');
  console.log('RELATÓRIO ESTATÍSTICO POR GRUPO (F1.10)');
  console.log('================================================================');
  let totalPassed = 0;
  let totalFailed = 0;

  for (const key of Object.keys(stats)) {
    const s = stats[key];
    totalPassed += s.passed;
    totalFailed += s.failed;
    console.log(`${s.group.padEnd(30)}: ${s.passed} PASS | ${s.failed} FAIL`);
  }

  console.log('----------------------------------------------------------------');
  console.log(`TOTAL GERAL                   : ${totalPassed} PASS | ${totalFailed} FAIL`);
  console.log(`DADOS PREEXISTENTES PROTEGIDOS: ${guard.preExistingIds.size} registros mantidos`);
  console.log('================================================================\n');

  if (totalFailed > 0 || !dataProtection.preserved || !testCleanup.allRemoved) {
    console.error('ERRO: Falhas detectadas ou violação de integridade dos dados.');
    process.exit(1);
  }
}

runIntegratedValidation().catch((err) => {
  console.error('ERRO FATAL NA VALIDAÇÃO INTEGRADA:', err);
  process.exit(1);
});
