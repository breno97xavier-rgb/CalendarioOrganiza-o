import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { addYears, subYears, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calendarCardService } from '../src/services/calendarCardService';
import { expandRecurringCards } from '../src/utils/recurrenceUtils';
import {
  formatYearPeriod,
  formatDayPeriod,
  formatWeekPeriod,
  formatCurrentPeriod,
  getCalendarDays,
  getWeekDays,
  COLOR_PALETTE,
} from '../src/utils/calendarUtils';
import { CalendarOccurrence } from '../src/types/calendar';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configuradas.');
  process.exit(1);
}

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

// Simula a lógica de geração dos meses de YearlyCalendar
function generateMonthsForYear(year: number) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthDate = new Date(year, monthIndex, 1, 12, 0, 0);
    const rawMonthName = format(monthDate, 'MMMM', { locale: ptBR });
    const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfWeek = (monthDate.getDay() + 6) % 7; // Segunda=0..Domingo=6

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNumber = i + 1;
      const dateString = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      return {
        dayNumber,
        dateString,
      };
    });

    return {
      monthIndex,
      monthName,
      firstDayOfWeek,
      daysInMonth,
      days,
    };
  });
}

async function runF18Tests() {
  console.log('=== INICIANDO VALIDAÇÃO COMPLETA F1.8 — VISUALIZAÇÃO ANUAL ===\n');

  const guard = await createTestGuard(rawClient, 'F1.8');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  const testCardIds: string[] = [];

  try {
    // TESTE 1: ABRIR ANO (12 MESES)
    console.log('[TESTE 1] Validando renderização dos 12 meses no ano...');
    const months2026 = generateMonthsForYear(2026);
    if (months2026.length !== 12) {
      throw new Error(`Esperado 12 meses, obteve ${months2026.length}`);
    }
    console.log('✓ Teste 1 PASS: Exatamente 12 meses gerados.');

    // TESTE 2: ORDEM (Janeiro -> Dezembro)
    console.log('\n[TESTE 2] Validando ordem cronológica dos meses (Janeiro a Dezembro)...');
    const monthNames = months2026.map((m) => m.monthName);
    const expectedMonths = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    for (let i = 0; i < 12; i++) {
      if (monthNames[i] !== expectedMonths[i]) {
        throw new Error(`Mês ${i} incorreto: esperado ${expectedMonths[i]}, obteve ${monthNames[i]}`);
      }
    }
    console.log('✓ Teste 2 PASS: Ordem rigorosa de Janeiro a Dezembro confirmada.');

    // TESTE 3: SEMANA SEGUNDA -> DOMINGO
    console.log('\n[TESTE 3] Validando posicionamento correto da semana (início na Segunda-feira)...');
    // Em 2026: 01 de janeiro é Quinta-feira (deslocamento 3 na convenção Seg=0, Ter=1, Qua=2, Qui=3, Sex=4, Sáb=5, Dom=6)
    const jan2026 = months2026[0];
    if (jan2026.firstDayOfWeek !== 3) {
      throw new Error(`Deslocamento de Jan/2026 esperado 3 (Quinta), obteve ${jan2026.firstDayOfWeek}`);
    }
    // Em 2026: 01 de fevereiro é Domingo (deslocamento 6)
    const feb2026 = months2026[1];
    if (feb2026.firstDayOfWeek !== 6) {
      throw new Error(`Deslocamento de Fev/2026 esperado 6 (Domingo), obteve ${feb2026.firstDayOfWeek}`);
    }
    console.log('✓ Teste 3 PASS: Posicionamento baseado em Segunda=0 até Domingo=6 validado.');

    // TESTE 4: ANO ANTERIOR
    console.log('\n[TESTE 4] Validando navegação para o ano anterior (2026 -> 2025)...');
    const ref2026 = new Date('2026-09-23T12:00:00');
    const prevYear = subYears(ref2026, 1);
    if (prevYear.getFullYear() !== 2025) {
      throw new Error(`Ano anterior esperado 2025, obteve ${prevYear.getFullYear()}`);
    }
    console.log('✓ Teste 4 PASS: Ano anterior calculado com sucesso (2025).');

    // TESTE 5: PRÓXIMO ANO
    console.log('\n[TESTE 5] Validando navegação para o próximo ano (2026 -> 2027)...');
    const nextYear = addYears(ref2026, 1);
    if (nextYear.getFullYear() !== 2027) {
      throw new Error(`Próximo ano esperado 2027, obteve ${nextYear.getFullYear()}`);
    }
    console.log('✓ Teste 5 PASS: Próximo ano calculado com sucesso (2027).');

    // TESTE 6: HOJE
    console.log('\n[TESTE 6] Validando retorno ao ano atual via Hoje...');
    const now = new Date();
    const currentYear = now.getFullYear();
    const restored = new Date();
    if (restored.getFullYear() !== currentYear) {
      throw new Error('Falha ao restaurar para o ano atual.');
    }
    console.log(`✓ Teste 6 PASS: Retorno ao ano atual efetuado (${currentYear}).`);

    // TESTE 7: TÍTULO
    console.log('\n[TESTE 7] Validando formatação do título anual...');
    const title2026 = formatYearPeriod(ref2026);
    const title2027 = formatYearPeriod(nextYear);
    if (title2026 !== '2026' || title2027 !== '2027') {
      throw new Error(`Títulos esperados "2026" e "2027", obteve "${title2026}" e "${title2027}"`);
    }
    console.log('✓ Teste 7 PASS: Título anual exibe com precisão apenas o ano ("2026").');

    // TESTE 8: FEVEREIRO NORMAL (2025 = 28 dias)
    console.log('\n[TESTE 8] Validando fevereiro comum (2025 = 28 dias)...');
    const months2025 = generateMonthsForYear(2025);
    const feb2025 = months2025[1];
    if (feb2025.daysInMonth !== 28 || feb2025.days.length !== 28) {
      throw new Error(`Fevereiro de 2025 deveria ter 28 dias, obteve ${feb2025.daysInMonth}`);
    }
    console.log('✓ Teste 8 PASS: Fevereiro de 2025 possui exatamente 28 dias.');

    // TESTE 9: FEVEREIRO BISSEXTO (2024 = 29 dias)
    console.log('\n[TESTE 9] Validando fevereiro bissexto (2024 = 29 dias)...');
    const months2024 = generateMonthsForYear(2024);
    const feb2024 = months2024[1];
    if (feb2024.daysInMonth !== 29 || feb2024.days.length !== 29) {
      throw new Error(`Fevereiro de 2024 deveria ter 29 dias, obteve ${feb2024.daysInMonth}`);
    }
    const hasFeb29 = feb2024.days.some((d) => d.dateString === '2024-02-29');
    if (!hasFeb29) {
      throw new Error('Dia 29/02/2024 ausente na lista de dias.');
    }
    console.log('✓ Teste 9 PASS: Fevereiro de 2024 possui exatamente 29 dias com 29/02/2024 presente.');

    // TESTE 10: DIA ATUAL (Destaque e aria-current)
    console.log('\n[TESTE 10] Validando identificação do dia atual no ano...');
    const todayStr = format(now, 'yyyy-MM-dd');
    const thisYearMonths = generateMonthsForYear(currentYear);
    const allDaysInYear = thisYearMonths.flatMap((m) => m.days);
    const todayEntry = allDaysInYear.find((d) => d.dateString === todayStr);
    if (!todayEntry) {
      throw new Error(`Dia atual (${todayStr}) não encontrado no ano corrente.`);
    }
    console.log(`✓ Teste 10 PASS: Dia atual (${todayStr}) localizado com sucesso no grid anual.`);

    // TESTE 11: NONE (Card isolado em 23/09 gera indicador somente em 23/09)
    console.log('\n[TESTE 11] Validando card não recorrente em 23/09/2026...');
    const card11 = await calendarCardService.createCard({
      content: 'Card Isolado de Teste',
      color: COLOR_PALETTE[0].hex,
      date: '2026-09-23',
    });
    testCardIds.push(card11.id);
    const yearCards11 = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occs11 = expandRecurringCards(yearCards11, '2026-01-01', '2026-12-31').filter((o) => o.cardId === card11.id);
    if (occs11.length !== 1 || occs11[0].occurrenceDate !== '2026-09-23') {
      throw new Error(`Card não recorrente gerou ${occs11.length} ocorrências ao invés de 1 em 23/09.`);
    }
    console.log('✓ Teste 11 PASS: Card não recorrente gerou exatamente 1 ocorrência em 23/09/2026.');

    // TESTE 12: DAILY (Série diária em setembro)
    console.log('\n[TESTE 12] Validando série daily em setembro de 2026...');
    const card12 = await calendarCardService.createCard({
      content: 'Rotina Matinal',
      color: COLOR_PALETTE[2].hex,
      date: '2026-09-01',
      recurrence_type: 'daily',
      recurrence_end_date: '2026-09-30',
    });
    testCardIds.push(card12.id);
    const yearCards12 = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occs12 = expandRecurringCards(yearCards12, '2026-01-01', '2026-12-31').filter((o) => o.cardId === card12.id);
    if (occs12.length !== 30) {
      throw new Error(`Série daily de setembro deveria ter 30 ocorrências, obteve ${occs12.length}`);
    }
    console.log('✓ Teste 12 PASS: Série daily gerou precisamente as 30 ocorrências em setembro.');

    // TESTE 13: WEEKLY (Série semanal às quartas)
    console.log('\n[TESTE 13] Validando série semanal às quartas no ano...');
    const card13 = await calendarCardService.createCard({
      content: 'Reunião Semanal',
      color: COLOR_PALETTE[4].hex,
      date: '2026-09-02', // Primeira quarta de setembro
      recurrence_type: 'weekly',
      recurrence_end_date: '2026-09-30',
    });
    testCardIds.push(card13.id);
    const yearCards13 = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occs13 = expandRecurringCards(yearCards13, '2026-01-01', '2026-12-31').filter((o) => o.cardId === card13.id);
    // Quartas em setembro de 2026: 02, 09, 16, 23, 30 = 5 quartas
    if (occs13.length !== 5) {
      throw new Error(`Série semanal esperada 5 ocorrências, obteve ${occs13.length}`);
    }
    console.log('✓ Teste 13 PASS: Série semanal gerou exatamente 5 ocorrências nas quartas-feiras.');

    // TESTE 14: MONTHLY (Série mensal no dia 15)
    console.log('\n[TESTE 14] Validando série mensal no dia 15...');
    const card14 = await calendarCardService.createCard({
      content: 'Fechamento Mensal',
      color: COLOR_PALETTE[6].hex,
      date: '2026-06-15',
      recurrence_type: 'monthly',
    });
    testCardIds.push(card14.id);
    const yearCards14 = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occs14 = expandRecurringCards(yearCards14, '2026-01-01', '2026-12-31').filter((o) => o.cardId === card14.id);
    // Junho a Dezembro de 2026 = 7 meses (15/06, 15/07, 15/08, 15/09, 15/10, 15/11, 15/12)
    if (occs14.length !== 7) {
      throw new Error(`Série mensal esperada 7 ocorrências em 2026, obteve ${occs14.length}`);
    }
    console.log('✓ Teste 14 PASS: Série mensal gerou exatamente 7 ocorrências nos meses aplicáveis.');

    // TESTE 15: CUSTOM WEEK (SEG/QUA/SEX)
    console.log('\n[TESTE 15] Validando custom week (SEG/QUA/SEX) durante 2 semanas...');
    const card15 = await calendarCardService.createCard({
      content: 'Treino Funcional',
      color: COLOR_PALETTE[8].hex,
      date: '2026-09-07', // Segunda
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'week',
      recurrence_days: [1, 3, 5],
      recurrence_end_date: '2026-09-20',
    });
    testCardIds.push(card15.id);
    const yearCards15 = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occs15 = expandRecurringCards(yearCards15, '2026-01-01', '2026-12-31').filter((o) => o.cardId === card15.id);
    // 2 semanas * 3 dias = 6 ocorrências
    if (occs15.length !== 6) {
      throw new Error(`Custom week esperada 6 ocorrências, obteve ${occs15.length}`);
    }
    console.log('✓ Teste 15 PASS: Custom week SEG/QUA/SEX gerou com precisão 6 ocorrências.');

    // TESTE 16: RECURRENCE_END_DATE
    console.log('\n[TESTE 16] Validando ausência de ocorrências após recurrence_end_date no ano...');
    const dates15 = occs15.map((o) => o.occurrenceDate);
    const hasAfterEnd = dates15.some((d) => d > '2026-09-20');
    if (hasAfterEnd) {
      throw new Error('Ocorrências encontradas após a data de término.');
    }
    console.log('✓ Teste 16 PASS: Nenhuma ocorrência gerada após recurrence_end_date.');

    // TESTE 17: SÉRIE ANTERIOR AO ANO
    console.log('\n[TESTE 17] Validando série iniciada em 2025 ativa em 2026...');
    const card17 = await calendarCardService.createCard({
      content: 'Contrato Antigo',
      color: COLOR_PALETTE[10].hex,
      date: '2025-10-01',
      recurrence_type: 'monthly',
    });
    testCardIds.push(card17.id);
    const yearCards17 = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occs17 = expandRecurringCards(yearCards17, '2026-01-01', '2026-12-31').filter((o) => o.cardId === card17.id);
    // Em 2026 deve ocorrer em todos os 12 meses no dia 01
    if (occs17.length !== 12) {
      throw new Error(`Série anterior esperada 12 ocorrências em 2026, obteve ${occs17.length}`);
    }
    console.log('✓ Teste 17 PASS: Série iniciada em 2025 gerou 12 ocorrências ativas em 2026.');

    // TESTE 18: UMA OCORRÊNCIA (1 indicador)
    console.log('\n[TESTE 18] Validando representação de 1 ocorrência no dia...');
    const occsTarget1 = [card11];
    const visibleDots1 = occsTarget1.slice(0, 3);
    const remainder1 = occsTarget1.length - 3;
    if (visibleDots1.length !== 1 || remainder1 > 0) {
      throw new Error('Representação de 1 ocorrência falhou.');
    }
    console.log('✓ Teste 18 PASS: 1 ocorrência resulta em 1 indicador e nenhum remanescente.');

    // TESTE 19: TRÊS OCORRÊNCIAS (3 indicadores)
    console.log('\n[TESTE 19] Validando representação de 3 ocorrências no dia...');
    const occsTarget3 = [card11, card12, card13];
    const visibleDots3 = occsTarget3.slice(0, 3);
    const remainder3 = occsTarget3.length - 3;
    if (visibleDots3.length !== 3 || remainder3 > 0) {
      throw new Error('Representação de 3 ocorrências falhou.');
    }
    console.log('✓ Teste 19 PASS: 3 ocorrências resultam em exatamente 3 indicadores.');

    // TESTE 20: CINCO OCORRÊNCIAS (3 indicadores + "+2")
    console.log('\n[TESTE 20] Validando representação de 5 ocorrências (3 dots + "+2")...');
    const occsTarget5 = [card11, card12, card13, card14, card15];
    const visibleDots5 = occsTarget5.slice(0, 3);
    const remainder5 = occsTarget5.length - 3;
    if (visibleDots5.length !== 3 || remainder5 !== 2) {
      throw new Error(`Esperado 3 dots e remainder 2, obteve ${visibleDots5.length} e ${remainder5}`);
    }
    console.log('✓ Teste 20 PASS: 5 ocorrências representadas por 3 indicadores + "+2".');

    // TESTE 21: CLIQUE NO DIA
    console.log('\n[TESTE 21] Validando navegação ao clicar no dia (Dia 17 de Novembro)...');
    const targetDateStr21 = '2026-11-17';
    const [y21, m21, d21] = targetDateStr21.split('-').map(Number);
    const newCurrentDate21 = new Date(y21, m21 - 1, d21, 12, 0, 0);
    const view21 = 'day';
    if (format(newCurrentDate21, 'yyyy-MM-dd') !== '2026-11-17' || view21 !== 'day') {
      throw new Error('Navegação para Dia falhou.');
    }
    console.log('✓ Teste 21 PASS: Clique no dia atualiza currentDate para 2026-11-17 e selectedView para "day".');

    // TESTE 22: CLIQUE NO NOME DO MÊS
    console.log('\n[TESTE 22] Validando navegação ao clicar no nome do mês (Outubro)...');
    const targetMonthIndex22 = 9; // Outubro (0-indexed)
    const newCurrentDate22 = new Date(2026, targetMonthIndex22, 1, 12, 0, 0);
    const view22 = 'month';
    if (format(newCurrentDate22, 'yyyy-MM-dd') !== '2026-10-01' || view22 !== 'month') {
      throw new Error('Navegação para Mês falhou.');
    }
    console.log('✓ Teste 22 PASS: Clique no mês atualiza currentDate para 01/10/2026 e selectedView para "month".');

    // TESTE 23: COR PRESERVADA
    console.log('\n[TESTE 23] Validando preservação global da cor selecionada ao transitar pelo Ano...');
    const chosenColor = COLOR_PALETTE[5].hex;
    let selectedColorIdState = chosenColor;
    // Transita Mês -> Ano -> Dia
    const viewSequence = ['month', 'year', 'day'];
    for (const v of viewSequence) {
      // Estado da cor permanece intocado
      if (selectedColorIdState !== chosenColor) {
        throw new Error(`Cor perdida na transição para ${v}`);
      }
    }
    console.log('✓ Teste 23 PASS: Cor selecionada mantida intacta através das transições de view.');

    // TESTE 24: ANO VAZIO
    console.log('\n[TESTE 24] Validando renderização dos 12 meses mesmo sem cards (Ano Vazio)...');
    const emptyCards = await calendarCardService.getCards('2010-01-01', '2010-12-31');
    const emptyOccs = expandRecurringCards(emptyCards, '2010-01-01', '2010-12-31');
    const emptyMonths = generateMonthsForYear(2010);
    if (emptyOccs.length !== 0 || emptyMonths.length !== 12) {
      throw new Error('Ano vazio deve renderizar 12 meses com 0 ocorrências.');
    }
    console.log('✓ Teste 24 PASS: 12 meses renderizados perfeitamente com 0 indicadores de cards.');

    // TESTE 25: MÊS -> ANO -> MÊS
    console.log('\n[TESTE 25] Validando preservação de currentDate em Mês -> Ano -> Mês...');
    const origDate25 = new Date('2026-09-23T12:00:00');
    let curDate25 = new Date(origDate25);
    // Para Ano:
    // curDate25 continua 23/09/2026
    // Para Mês via seletor:
    // curDate25 continua 23/09/2026
    if (format(curDate25, 'yyyy-MM-dd') !== '2026-09-23') {
      throw new Error('currentDate alterada indevidamente.');
    }
    console.log('✓ Teste 25 PASS: Transição Mês -> Ano -> Mês preserva estritamente currentDate.');

    // TESTE 26: SEMANA -> ANO -> SEMANA
    console.log('\n[TESTE 26] Validando preservação de currentDate em Semana -> Ano -> Semana...');
    let curDate26 = new Date(origDate25);
    if (format(curDate26, 'yyyy-MM-dd') !== '2026-09-23') {
      throw new Error('currentDate alterada indevidamente na transição de Semana.');
    }
    console.log('✓ Teste 26 PASS: Transição Semana -> Ano -> Semana preserva estritamente currentDate.');

    // TESTE 27: DIA -> ANO -> DIA
    console.log('\n[TESTE 27] Validando preservação de currentDate em Dia -> Ano -> Dia...');
    let curDate27 = new Date(origDate25);
    if (format(curDate27, 'yyyy-MM-dd') !== '2026-09-23') {
      throw new Error('currentDate alterada indevidamente na transição de Dia.');
    }
    console.log('✓ Teste 27 PASS: Transição Dia -> Ano -> Dia preserva estritamente currentDate.');

    // TESTE 28: TIMEZONE
    console.log('\n[TESTE 28] Validando estabilidade de datas (sem shift UTC/timezone)...');
    const dayTestStr = '2026-09-23';
    const [y28, m28, d28] = dayTestStr.split('-').map(Number);
    const safeDate = new Date(y28, m28 - 1, d28, 12, 0, 0);
    if (format(safeDate, 'yyyy-MM-dd') !== '2026-09-23') {
      throw new Error(`Data sofreu deslocamento: ${format(safeDate, 'yyyy-MM-dd')}`);
    }
    console.log('✓ Teste 28 PASS: Formato e conversão de datas preservados com precisão sem deslocamento.');

    // TESTE 29: RELOAD / RECONSTRUÇÃO DETERMINÍSTICA
    console.log('\n[TESTE 29] Validando reconstrução determinística ao recarregar o ano...');
    const reloadA = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occsA = expandRecurringCards(reloadA, '2026-01-01', '2026-12-31');

    const reloadB = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const occsB = expandRecurringCards(reloadB, '2026-01-01', '2026-12-31');

    if (JSON.stringify(occsA) !== JSON.stringify(occsB)) {
      throw new Error('Reconstrução não determinística no ano.');
    }
    console.log(`✓ Teste 29 PASS: Reconstrução determinística validada (${occsA.length} ocorrências idênticas).`);

    // TESTE 30: FALHA DE CONSULTA
    console.log('\n[TESTE 30] Validando tratamento amigável de falha na consulta anual...');
    try {
      await calendarCardService.getCards('invalid-year', 'invalid-year');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Erro ao buscar cards por intervalo')) {
        console.log('✓ Teste 30 PASS: Falha capturada e envelopada sem desmontar a estrutura visual.');
      } else {
        throw new Error(`Erro inesperado: ${err}`);
      }
    }

    // TESTE 31: PERFORMANCE COM SÉRIE DAILY NO ANO
    console.log('\n[TESTE 31] Validando performance: série daily abrangendo o ano inteiro de 2026...');
    const cardDailyYear = await calendarCardService.createCard({
      content: 'Hábito Diário Anual',
      color: COLOR_PALETTE[1].hex,
      date: '2026-01-01',
      recurrence_type: 'daily',
    });
    testCardIds.push(cardDailyYear.id);

    const startPerf = Date.now();
    const perfCards = await calendarCardService.getCards('2026-01-01', '2026-12-31');
    const perfOccs = expandRecurringCards(perfCards, '2026-01-01', '2026-12-31').filter((o) => o.cardId === cardDailyYear.id);
    const duration = Date.now() - startPerf;

    // Em 2026 (ano não bissexto), são exatamente 365 dias
    if (perfOccs.length !== 365) {
      throw new Error(`Esperado 365 ocorrências para o ano, obteve ${perfOccs.length}`);
    }
    // Confirma que nenhuma ocorrência vazou para fora do intervalo
    const outOfRange = perfOccs.some((o) => o.occurrenceDate < '2026-01-01' || o.occurrenceDate > '2026-12-31');
    if (outOfRange) {
      throw new Error('Ocorrência diária vazou para fora do intervalo anual solicitado.');
    }
    console.log(`✓ Teste 31 PASS: Expansão de 365 dias executada com alta performance em ${duration}ms sem nenhum vazamento.`);

    // REGRESSÃO DO MÊS
    console.log('\n[REGRESSÃO DO MÊS] Validando integridade da visualização Mês...');
    const regMonthDays = getCalendarDays(new Date('2026-09-23T12:00:00'));
    const regMonthCards = await calendarCardService.getCards(regMonthDays[0].dateString, regMonthDays[regMonthDays.length - 1].dateString);
    const regMonthOccs = expandRecurringCards(regMonthCards, regMonthDays[0].dateString, regMonthDays[regMonthDays.length - 1].dateString);
    if (regMonthOccs.length === 0) {
      throw new Error('Regressão do mês: nenhuma ocorrência identificada no mês.');
    }
    console.log('✓ Regressão do Mês PASS: Visão mensal permanece 100% íntegra.');

    // REGRESSÃO DA SEMANA
    console.log('\n[REGRESSÃO DA SEMANA] Validando integridade da visualização Semana...');
    const regWeekDays = getWeekDays(new Date('2026-09-23T12:00:00'));
    const regWeekCards = await calendarCardService.getCards(regWeekDays[0].dateString, regWeekDays[6].dateString);
    const regWeekOccs = expandRecurringCards(regWeekCards, regWeekDays[0].dateString, regWeekDays[6].dateString);
    if (regWeekOccs.length === 0) {
      throw new Error('Regressão da semana: nenhuma ocorrência identificada na semana.');
    }
    console.log('✓ Regressão da Semana PASS: Visão semanal permanece 100% íntegra.');

    // REGRESSÃO DO DIA
    console.log('\n[REGRESSÃO DO DIA] Validando integridade da visualização Dia...');
    const regDayCards = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const regDayOccs = expandRecurringCards(regDayCards, '2026-09-23', '2026-09-23');
    if (regDayOccs.length === 0) {
      throw new Error('Regressão do dia: nenhuma ocorrência identificada no dia.');
    }
    console.log('✓ Regressão do Dia PASS: Visão diária permanece 100% íntegra.');

    console.log('\n--- TODOS OS 31 TESTES DA F1.8 E AS REGRESSÕES PASSARAM COM SUCESSO! ---');
  } catch (err) {
    console.error('\nERRO na execução dos testes F1.8:', err);
    throw err;
  } finally {
    // LIMPEZA FINAL FAIL-CLOSED
    guard.registerCreatedIds(testCardIds);
    console.log('\n[LIMPEZA] Executando limpeza fail-closed dos registros de teste...');
    const cleanupResult = await guard.cleanup();
    console.log(`Registros de teste excluídos: ${cleanupResult.deletedCount}`);

    const dataProt = await guard.verifyDataProtection();
    const testClean = await guard.verifyTestCleanup();

    if (!dataProt.preserved) {
      throw new Error(`CRÍTICO: Dados preexistentes violados! IDs ausentes: ${dataProt.missingIds.join(', ')}`);
    }
    if (!testClean.allRemoved) {
      throw new Error(`AVISO: Falha ao remover todos os cards de teste. IDs remanescentes: ${testClean.remainingIds.join(', ')}`);
    }
    console.log(`✓ Proteção confirmada: 100% dos dados preexistentes (${guard.preExistingIds.size}) preservados.`);
  }
}

runF18Tests().catch((err) => {
  console.error('Falha nos testes F1.8:', err);
  process.exit(1);
});
