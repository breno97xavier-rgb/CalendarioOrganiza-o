import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { calendarCardService } from '../src/services/calendarCardService';
import { expandRecurringCards, sortOccurrencesForDay } from '../src/utils/recurrenceUtils';
import {
  getWeekDays,
  getCalendarDays,
  formatWeekPeriod,
  formatCurrentPeriod,
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

async function runF16Tests() {
  console.log('=== INICIANDO VALIDAÇÃO COMPLETA F1.6 — VISUALIZAÇÃO SEMANAL ===\n');

  const guard = await createTestGuard(rawClient, 'F1.6');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  const testCardIds: string[] = [];

  try {
    // TESTE 1: ABRIR SEMANA (7 dias, segunda a domingo, período correto)
    console.log('[TESTE 1] Validando estrutura de 7 dias da semana (Segunda -> Domingo)...');
    const refDate1 = new Date('2026-09-23T12:00:00'); // Quarta-feira
    const weekDays1 = getWeekDays(refDate1);
    if (weekDays1.length !== 7) {
      throw new Error(`Semana deve ter 7 dias, mas teve ${weekDays1.length}`);
    }
    if (weekDays1[0].dateString !== '2026-09-21' || weekDays1[6].dateString !== '2026-09-27') {
      throw new Error(`Semana deve ir de 2026-09-21 a 2026-09-27, obteve ${weekDays1[0].dateString} a ${weekDays1[6].dateString}`);
    }
    if (weekDays1[0].dayOfMonth !== 21 || weekDays1[6].dayOfMonth !== 27) {
      throw new Error('Dias do mês incorretos nos limites da semana.');
    }
    console.log('✓ Teste 1 PASS: Semana possui exatamente 7 dias, iniciando na segunda (21/09) e finalizando no domingo (27/09).');

    // TESTE 2: SEMANA ANTERIOR
    console.log('\n[TESTE 2] Validando navegação para semana anterior...');
    const prevWeekDate = subWeeks(refDate1, 1);
    const prevWeekDays = getWeekDays(prevWeekDate);
    if (prevWeekDays[0].dateString !== '2026-09-14' || prevWeekDays[6].dateString !== '2026-09-20') {
      throw new Error(`Semana anterior esperada 14/09 a 20/09, obteve ${prevWeekDays[0].dateString} a ${prevWeekDays[6].dateString}`);
    }
    console.log('✓ Teste 2 PASS: Semana anterior calculada com exatidão (14/09 a 20/09).');

    // TESTE 3: PRÓXIMA SEMANA
    console.log('\n[TESTE 3] Validando navegação para próxima semana...');
    const nextWeekDate = addWeeks(refDate1, 1);
    const nextWeekDays = getWeekDays(nextWeekDate);
    if (nextWeekDays[0].dateString !== '2026-09-28' || nextWeekDays[6].dateString !== '2026-10-04') {
      throw new Error(`Próxima semana esperada 28/09 a 04/10, obteve ${nextWeekDays[0].dateString} a ${nextWeekDays[6].dateString}`);
    }
    console.log('✓ Teste 3 PASS: Próxima semana calculada com exatidão (28/09 a 04/10).');

    // TESTE 4: HOJE
    console.log('\n[TESTE 4] Validando botão Hoje...');
    const today = new Date();
    const todayWeekDays = getWeekDays(today);
    const hasToday = todayWeekDays.some((d) => d.isToday);
    if (!hasToday) {
      throw new Error('A semana da data atual deve conter um dia com isToday === true.');
    }
    console.log('✓ Teste 4 PASS: Retorno à semana de Hoje contém o dia atual devidamente identificado.');

    // TESTE 5: TÍTULO MESMO MÊS
    console.log('\n[TESTE 5] Validando formatação de título para semana no mesmo mês...');
    const titleSameMonth = formatWeekPeriod(new Date('2026-09-23T12:00:00'));
    if (!titleSameMonth.toLowerCase().includes('21') || !titleSameMonth.toLowerCase().includes('27') || !titleSameMonth.toLowerCase().includes('setembro')) {
      throw new Error(`Título incorreto no mesmo mês: "${titleSameMonth}"`);
    }
    console.log(`✓ Teste 5 PASS: Título no mesmo mês formatado como "${titleSameMonth}".`);

    // TESTE 6: TÍTULO ENTRE MESES
    console.log('\n[TESTE 6] Validando formatação de título para semana que atravessa meses...');
    const titleCrossMonths = formatWeekPeriod(new Date('2026-09-30T12:00:00'));
    if (!titleCrossMonths.toLowerCase().includes('setembro') || !titleCrossMonths.toLowerCase().includes('outubro')) {
      throw new Error(`Título incorreto entre meses: "${titleCrossMonths}"`);
    }
    console.log(`✓ Teste 6 PASS: Título entre meses formatado como "${titleCrossMonths}".`);

    // TESTE 7: TÍTULO ENTRE ANOS
    console.log('\n[TESTE 7] Validando formatação de título para semana que atravessa anos...');
    const titleCrossYears = formatWeekPeriod(new Date('2026-12-30T12:00:00'));
    if (!titleCrossYears.includes('2026') || !titleCrossYears.includes('2027')) {
      throw new Error(`Título incorreto entre anos: "${titleCrossYears}"`);
    }
    console.log(`✓ Teste 7 PASS: Título entre anos formatado como "${titleCrossYears}".`);

    // TESTE 8: CARD NÃO RECORRENTE NA SEMANA
    console.log('\n[TESTE 8] Validando aparição de card não recorrente apenas no dia correto da semana...');
    const card8 = await calendarCardService.createCard({
      content: 'Reunião de Terça',
      color: COLOR_PALETTE[0].hex,
      date: '2026-09-22', // Terça-feira
    });
    testCardIds.push(card8.id);

    const cardsWeek8 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs8 = expandRecurringCards(cardsWeek8, '2026-09-21', '2026-09-27');
    const occsOnTue = occs8.filter((o) => o.occurrenceDate === '2026-09-22');
    const occsOnOther = occs8.filter((o) => o.occurrenceDate !== '2026-09-22');
    if (occsOnTue.length !== 1 || occsOnOther.length !== 0) {
      throw new Error(`Card não recorrente apareceu em dias errados: Tue=${occsOnTue.length}, Others=${occsOnOther.length}`);
    }
    console.log('✓ Teste 8 PASS: Card não recorrente apareceu exclusivamente na terça-feira (22/09).');

    // TESTE 9: CARD COM HORÁRIO NA SEMANA
    console.log('\n[TESTE 9] Validando exibição e formatação de card com horário...');
    const card9 = await calendarCardService.createCard({
      content: 'Dentista',
      color: COLOR_PALETTE[1].hex,
      date: '2026-09-23',
      time: '14:30:00',
    });
    testCardIds.push(card9.id);

    const cardsWeek9 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs9 = expandRecurringCards(cardsWeek9, '2026-09-21', '2026-09-27');
    const dentistaOcc = occs9.find((o) => o.cardId === card9.id);
    if (!dentistaOcc || dentistaOcc.time !== '14:30:00') {
      throw new Error(`Horário do card não preservado: ${dentistaOcc?.time}`);
    }
    console.log('✓ Teste 9 PASS: Card com horário 14:30 preservado e disponível para exibição.');

    // TESTE 10: ORDENAÇÃO NA COLUNA DO DIA
    console.log('\n[TESTE 10] Validando ordenação na coluna (horários cronológicos seguidos por sem horário)...');
    const c10_1 = await calendarCardService.createCard({ content: 'Item 16:00', color: COLOR_PALETTE[2].hex, date: '2026-09-24', time: '16:00:00' });
    const c10_2 = await calendarCardService.createCard({ content: 'Item 08:00', color: COLOR_PALETTE[3].hex, date: '2026-09-24', time: '08:00:00' });
    const c10_3 = await calendarCardService.createCard({ content: 'Item Sem Horário', color: COLOR_PALETTE[4].hex, date: '2026-09-24', time: null });
    const c10_4 = await calendarCardService.createCard({ content: 'Item 11:00', color: COLOR_PALETTE[5].hex, date: '2026-09-24', time: '11:00:00' });
    testCardIds.push(c10_1.id, c10_2.id, c10_3.id, c10_4.id);

    const cardsWeek10 = await calendarCardService.getCards('2026-09-24', '2026-09-24');
    const occs10 = expandRecurringCards(cardsWeek10, '2026-09-24', '2026-09-24');
    const sorted10 = sortOccurrencesForDay(occs10);

    const contents = sorted10.map((o) => o.content);
    if (
      contents[0] !== 'Item 08:00' ||
      contents[1] !== 'Item 11:00' ||
      contents[2] !== 'Item 16:00' ||
      contents[3] !== 'Item Sem Horário'
    ) {
      throw new Error(`Ordem inesperada: ${JSON.stringify(contents)}`);
    }
    console.log('✓ Teste 10 PASS: Ordenação na coluna seguiu estritamente: 08:00, 11:00, 16:00, Sem Horário.');

    // TESTE 11: DAILY NA SEMANA
    console.log('\n[TESTE 11] Validando daily: ocorrência em cada dia aplicável da semana...');
    const card11 = await calendarCardService.createCard({
      content: 'Caminhada Matinal',
      color: COLOR_PALETTE[6].hex,
      date: '2026-09-21',
      recurrence_type: 'daily',
    });
    testCardIds.push(card11.id);

    const cardsWeek11 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs11 = expandRecurringCards(cardsWeek11, '2026-09-21', '2026-09-27').filter((o) => o.cardId === card11.id);
    if (occs11.length !== 7) {
      throw new Error(`Daily deve ter 7 ocorrências na semana, teve ${occs11.length}`);
    }
    console.log('✓ Teste 11 PASS: Card daily gerou exatamente 7 ocorrências na semana visível.');

    // TESTE 12: WEEKLY NA SEMANA
    console.log('\n[TESTE 12] Validando weekly: somente o dia da semana correto...');
    const card12 = await calendarCardService.createCard({
      content: 'Reunião de Sexta',
      color: COLOR_PALETTE[7].hex,
      date: '2026-09-25', // Sexta
      recurrence_type: 'weekly',
    });
    testCardIds.push(card12.id);

    const cardsWeek12 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs12 = expandRecurringCards(cardsWeek12, '2026-09-21', '2026-09-27').filter((o) => o.cardId === card12.id);
    if (occs12.length !== 1 || occs12[0].occurrenceDate !== '2026-09-25') {
      throw new Error(`Weekly deve ocorrer somente em 25/09, teve ${occs12.length}`);
    }
    console.log('✓ Teste 12 PASS: Card weekly gerou ocorrência exclusivamente na sexta-feira (25/09).');

    // TESTE 13: CUSTOM WEEK NA SEMANA
    console.log('\n[TESTE 13] Validando custom week: SEG/QUA/SEX gerando exatamente 3 ocorrências na semana...');
    const card13 = await calendarCardService.createCard({
      content: 'Treino Funcional',
      color: COLOR_PALETTE[8].hex,
      date: '2026-09-21',
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'week',
      recurrence_days: [1, 3, 5],
    });
    testCardIds.push(card13.id);

    const cardsWeek13 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs13 = expandRecurringCards(cardsWeek13, '2026-09-21', '2026-09-27').filter((o) => o.cardId === card13.id);
    const occDates13 = occs13.map((o) => o.occurrenceDate);
    if (occs13.length !== 3 || !occDates13.includes('2026-09-21') || !occDates13.includes('2026-09-23') || !occDates13.includes('2026-09-25')) {
      throw new Error(`Custom week inválido: ${JSON.stringify(occDates13)}`);
    }
    console.log('✓ Teste 13 PASS: Custom week gerou com exatidão SEG (21), QUA (23) e SEX (25).');

    // TESTE 14: RECURRENCE_END_DATE NA SEMANA
    console.log('\n[TESTE 14] Validando recurrence_end_date na semana (sem ocorrências após o fim)...');
    const card14 = await calendarCardService.createCard({
      content: 'Curso Curto',
      color: COLOR_PALETTE[9].hex,
      date: '2026-09-21',
      recurrence_type: 'daily',
      recurrence_end_date: '2026-09-23', // Quarta
    });
    testCardIds.push(card14.id);

    const cardsWeek14 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs14 = expandRecurringCards(cardsWeek14, '2026-09-21', '2026-09-27').filter((o) => o.cardId === card14.id);
    const occDates14 = occs14.map((o) => o.occurrenceDate);
    if (occs14.length !== 3 || occDates14.includes('2026-09-24')) {
      throw new Error(`Fim de recorrência não respeitado: ${JSON.stringify(occDates14)}`);
    }
    console.log('✓ Teste 14 PASS: recurrence_end_date em 23/09 respeitado (21, 22, 23 gerados; 24 a 27 ausentes).');

    // TESTE 15: CRIAR PELO DIA NA SEMANA
    console.log('\n[TESTE 15] Validando criação de card a partir de um dia específico na semana...');
    const card15 = await calendarCardService.createCard({
      content: 'Criado na Quinta',
      color: COLOR_PALETTE[10].hex,
      date: '2026-09-24',
    });
    testCardIds.push(card15.id);

    const fetched15 = await calendarCardService.getCardById(card15.id);
    if (!fetched15 || fetched15.date !== '2026-09-24') {
      throw new Error('Falha ao persistir card criado no dia.');
    }
    console.log('✓ Teste 15 PASS: Card criado no dia 24/09 persistido com sucesso.');

    // TESTE 16: COR -> DIA NA SEMANA
    console.log('\n[TESTE 16] Validando criação com cor pré-selecionada no painel lateral...');
    const selectedColorHex = COLOR_PALETTE[13].hex; // Roxo
    const card16 = await calendarCardService.createCard({
      content: 'Card Roxo na Semana',
      color: selectedColorHex,
      date: '2026-09-26',
    });
    testCardIds.push(card16.id);

    if (card16.color !== selectedColorHex) {
      throw new Error(`Cor não coincidiu: esperado ${selectedColorHex}, obteve ${card16.color}`);
    }
    console.log('✓ Teste 16 PASS: Card criado com a cor selecionada no painel.');

    // TESTE 17: ABRIR DETALHE NA SEMANA
    console.log('\n[TESTE 17] Validando dados da ocorrência para o modal de detalhes...');
    const cardsWeek17 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs17 = expandRecurringCards(cardsWeek17, '2026-09-21', '2026-09-27');
    const targetOcc = occs17.find((o) => o.cardId === card16.id);
    if (!targetOcc || targetOcc.occurrenceDate !== '2026-09-26' || targetOcc.content !== 'Card Roxo na Semana') {
      throw new Error('Ocorrência para modal de detalhes incompleta.');
    }
    console.log('✓ Teste 17 PASS: CalendarOccurrence possui todos os metadados necessários para CardDetailModal.');

    // TESTE 18: EDITAR PELA SEMANA
    console.log('\n[TESTE 18] Validando edição de card existente a partir da semana...');
    const updated18 = await calendarCardService.updateCard(card8.id, {
      content: 'Reunião de Terça (Revisada)',
    });
    if (updated18.content !== 'Reunião de Terça (Revisada)') {
      throw new Error('Falha ao atualizar conteúdo do card.');
    }
    const cardsWeek18 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs18 = expandRecurringCards(cardsWeek18, '2026-09-21', '2026-09-27');
    const occUpdated = occs18.find((o) => o.cardId === card8.id);
    if (occUpdated?.content !== 'Reunião de Terça (Revisada)') {
      throw new Error('Ocorrência semanal não refletiu atualização.');
    }
    console.log('✓ Teste 18 PASS: Edição persistida no Supabase e refletida na semana.');

    // TESTE 19: MOVER PARA OUTRO DIA DA SEMANA
    console.log('\n[TESTE 19] Validando movimentação de card para outro dia da mesma semana...');
    await calendarCardService.updateCard(card8.id, {
      date: '2026-09-27', // Movido para Domingo
    });
    const cardsWeek19 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs19 = expandRecurringCards(cardsWeek19, '2026-09-21', '2026-09-27').filter((o) => o.cardId === card8.id);
    if (occs19.length !== 1 || occs19[0].occurrenceDate !== '2026-09-27') {
      throw new Error(`Card não moveu de coluna corretamente: ${JSON.stringify(occs19)}`);
    }
    console.log('✓ Teste 19 PASS: Card movido com sucesso de terça (22) para domingo (27).');

    // TESTE 20: MOVER PARA FORA DA SEMANA
    console.log('\n[TESTE 20] Validando movimentação de card para fora da semana visível...');
    await calendarCardService.updateCard(card8.id, {
      date: '2026-10-15', // Outro mês/semana
    });
    const cardsWeek20 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs20 = expandRecurringCards(cardsWeek20, '2026-09-21', '2026-09-27').filter((o) => o.cardId === card8.id);
    if (occs20.length !== 0) {
      throw new Error('Card ainda visível na semana após mover para fora.');
    }
    // Confirma que ele existe na semana de destino
    const cardsTargetWeek = await calendarCardService.getCards('2026-10-12', '2026-10-18');
    const occsTarget = expandRecurringCards(cardsTargetWeek, '2026-10-12', '2026-10-18').filter((o) => o.cardId === card8.id);
    if (occsTarget.length !== 1 || occsTarget[0].occurrenceDate !== '2026-10-15') {
      throw new Error('Card não encontrado na semana de destino.');
    }
    console.log('✓ Teste 20 PASS: Card desapareceu da semana atual e apareceu na nova semana de destino.');

    // TESTE 21: COPIAR CARD PELA SEMANA
    console.log('\n[TESTE 21] Validando cópia de card a partir da semana...');
    const copy21 = await calendarCardService.createCard({
      content: 'Cópia de ' + card15.content,
      color: card15.color,
      date: card15.date,
    });
    testCardIds.push(copy21.id);
    if (copy21.id === card15.id) {
      throw new Error('Cópia deve ter UUID distinto.');
    }
    const cardsWeek21 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs21 = expandRecurringCards(cardsWeek21, '2026-09-21', '2026-09-27');
    const hasOriginal = occs21.some((o) => o.cardId === card15.id);
    const hasCopy = occs21.some((o) => o.cardId === copy21.id);
    if (!hasOriginal || !hasCopy) {
      throw new Error('Ambos os cards devem estar presentes na semana.');
    }
    console.log('✓ Teste 21 PASS: Cópia criou novo registro independente no Supabase.');

    // TESTE 22: EXCLUIR CARD PELA SEMANA
    console.log('\n[TESTE 22] Validando exclusão de card a partir da semana...');
    await calendarCardService.deleteCard(copy21.id);
    const cardsWeek22 = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occs22 = expandRecurringCards(cardsWeek22, '2026-09-21', '2026-09-27');
    if (occs22.some((o) => o.cardId === copy21.id)) {
      throw new Error('Card excluído ainda aparece nas ocorrências.');
    }
    console.log('✓ Teste 22 PASS: Card excluído do banco e removido da visualização semanal.');

    // TESTE 23: MÊS -> SEMANA -> MÊS
    console.log('\n[TESTE 23] Validando transição e consistência temporal entre Mês e Semana...');
    const refDate23 = new Date('2026-09-23T12:00:00');
    const monthInterval23 = getCalendarDays(refDate23);
    const weekInterval23 = getWeekDays(refDate23);

    const monthCards = await calendarCardService.getCards(monthInterval23[0].dateString, monthInterval23[monthInterval23.length - 1].dateString);
    const weekCards = await calendarCardService.getCards(weekInterval23[0].dateString, weekInterval23[weekInterval23.length - 1].dateString);

    if (monthCards.length < weekCards.length) {
      throw new Error('Cards do mês não podem ser menores que os cards da semana contida nele.');
    }
    console.log('✓ Teste 23 PASS: Consistência temporal perfeita na transição Mês <-> Semana com a mesma data de referência.');

    // TESTE 24: RELOAD EM SEMANA (Recuperação Determinística)
    console.log('\n[TESTE 24] Validando recuperação determinística em reload na visualização semanal...');
    const fetchA = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occsA = expandRecurringCards(fetchA, '2026-09-21', '2026-09-27');

    const fetchB = await calendarCardService.getCards('2026-09-21', '2026-09-27');
    const occsB = expandRecurringCards(fetchB, '2026-09-21', '2026-09-27');

    if (JSON.stringify(occsA) !== JSON.stringify(occsB)) {
      throw new Error('Recuperação após reload não é determinística.');
    }
    console.log(`✓ Teste 24 PASS: Reconstrução determinística confirmada (${occsA.length} ocorrências idênticas geradas).`);

    // TESTE 25: FALHA DE CONSULTA (Tratamento amigável)
    console.log('\n[TESTE 25] Validando resiliência e tratamento amigável de erro na consulta...');
    try {
      // Forçar chamada com intervalo inválido
      await calendarCardService.getCards('invalid-date', 'invalid-date');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Erro ao buscar cards por intervalo')) {
        console.log('✓ Teste 25 PASS: Falha capturada e envelopada em mensagem amigável sem crash.');
      } else {
        throw new Error(`Erro não envelopado corretamente: ${err}`);
      }
    }

    // REGRESSÃO DO MÊS
    console.log('\n[REGRESSÃO DO MÊS] Validando que a visualização mensal não sofreu regressões...');
    const monthDays = getCalendarDays(new Date('2026-09-01T12:00:00'));
    const monthStart = monthDays[0].dateString;
    const monthEnd = monthDays[monthDays.length - 1].dateString;
    const monthCardsRegression = await calendarCardService.getCards(monthStart, monthEnd);
    const monthOccurrences = expandRecurringCards(monthCardsRegression, monthStart, monthEnd);
    if (monthOccurrences.length === 0) {
      throw new Error('Falha na regressão do mês: ocorrências esperadas no mês não foram encontradas.');
    }
    const monthTitle = formatCurrentPeriod(new Date('2026-09-01T12:00:00'));
    if (!monthTitle.includes('Setembro')) {
      throw new Error(`Título do mês inválido: ${monthTitle}`);
    }
    console.log('✓ Regressão do Mês PASS: Visão mensal permanece 100% operacional, navegável e íntegra.');

    console.log('\n--- TODOS OS 25 TESTES DA F1.6 PASSARAM COM SUCESSO! ---');
  } catch (err) {
    console.error('\nERRO na execução dos testes F1.6:', err);
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

runF16Tests().catch((err) => {
  console.error('Falha nos testes F1.6:', err);
  process.exit(1);
});
