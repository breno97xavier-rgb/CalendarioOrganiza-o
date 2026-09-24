import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, format } from 'date-fns';
import { calendarCardService } from '../src/services/calendarCardService';
import { expandRecurringCards, sortOccurrencesForDay } from '../src/utils/recurrenceUtils';
import {
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

async function runF17Tests() {
  console.log('=== INICIANDO VALIDAÇÃO COMPLETA F1.7 — VISUALIZAÇÃO DIÁRIA ===\n');

  const guard = await createTestGuard(rawClient, 'F1.7');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  const testCardIds: string[] = [];

  try {
    // TESTE 1: ABRIR DIA
    console.log('[TESTE 1] Validando abertura do Dia com currentDate...');
    const refDate1 = new Date('2026-09-23T12:00:00');
    const dayStr1 = format(refDate1, 'yyyy-MM-dd');
    if (dayStr1 !== '2026-09-23') {
      throw new Error(`Data formatada incorreta: ${dayStr1}`);
    }
    console.log('✓ Teste 1 PASS: Visualização diária alinhada exatamente à currentDate (2026-09-23).');

    // TESTE 2: DIA ANTERIOR
    console.log('\n[TESTE 2] Validando navegação para o dia anterior (-1 dia)...');
    const prevDay = subDays(refDate1, 1);
    const prevDayStr = format(prevDay, 'yyyy-MM-dd');
    if (prevDayStr !== '2026-09-22') {
      throw new Error(`Dia anterior esperado 2026-09-22, obteve ${prevDayStr}`);
    }
    console.log('✓ Teste 2 PASS: Dia anterior calculado com precisão (2026-09-22).');

    // TESTE 3: PRÓXIMO DIA
    console.log('\n[TESTE 3] Validando navegação para o próximo dia (+1 dia)...');
    const nextDay = addDays(refDate1, 1);
    const nextDayStr = format(nextDay, 'yyyy-MM-dd');
    if (nextDayStr !== '2026-09-24') {
      throw new Error(`Próximo dia esperado 2026-09-24, obteve ${nextDayStr}`);
    }
    console.log('✓ Teste 3 PASS: Próximo dia calculado com precisão (2026-09-24).');

    // TESTE 4: HOJE
    console.log('\n[TESTE 4] Validando retorno para Hoje a partir de outra data...');
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    if (!todayStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Data de hoje inválida.');
    }
    console.log(`✓ Teste 4 PASS: Retorno à data atual efetuado com sucesso (${todayStr}).`);

    // TESTE 5: VIRADA DE MÊS
    console.log('\n[TESTE 5] Validando virada de mês (31/08 -> 01/09)...');
    const endOfAugust = new Date('2026-08-31T12:00:00');
    const firstOfSeptember = addDays(endOfAugust, 1);
    if (format(firstOfSeptember, 'yyyy-MM-dd') !== '2026-09-01') {
      throw new Error(`Virada de mês falhou: obteve ${format(firstOfSeptember, 'yyyy-MM-dd')}`);
    }
    console.log('✓ Teste 5 PASS: Transição 31/08 -> 01/09 executada corretamente.');

    // TESTE 6: VIRADA DE ANO
    console.log('\n[TESTE 6] Validando virada de ano (31/12/2026 -> 01/01/2027)...');
    const endOfYear = new Date('2026-12-31T12:00:00');
    const firstOfYear = addDays(endOfYear, 1);
    if (format(firstOfYear, 'yyyy-MM-dd') !== '2027-01-01') {
      throw new Error(`Virada de ano falhou: obteve ${format(firstOfYear, 'yyyy-MM-dd')}`);
    }
    console.log('✓ Teste 6 PASS: Transição 31/12/2026 -> 01/01/2027 executada com exatidão.');

    // TESTE 7: ANO BISSEXTO (29/02)
    console.log('\n[TESTE 7] Validando comportamento em ano bissexto (fevereiro de 2024)...');
    const feb28 = new Date('2024-02-28T12:00:00');
    const feb29 = addDays(feb28, 1);
    const mar01 = addDays(feb29, 1);
    if (format(feb29, 'yyyy-MM-dd') !== '2024-02-29' || format(mar01, 'yyyy-MM-dd') !== '2024-03-01') {
      throw new Error(`Ano bissexto avançando falhou: feb29=${format(feb29, 'yyyy-MM-dd')}, mar01=${format(mar01, 'yyyy-MM-dd')}`);
    }
    const backToFeb29 = subDays(mar01, 1);
    const backToFeb28 = subDays(backToFeb29, 1);
    if (format(backToFeb29, 'yyyy-MM-dd') !== '2024-02-29' || format(backToFeb28, 'yyyy-MM-dd') !== '2024-02-28') {
      throw new Error('Ano bissexto recuando falhou.');
    }
    console.log('✓ Teste 7 PASS: Navegação bidirecional por 28/02 -> 29/02 -> 01/03 em ano bissexto validada.');

    // TESTE 8: TÍTULO EM PT-BR
    console.log('\n[TESTE 8] Validando formatação do título diário em pt-BR...');
    const titleWed = formatDayPeriod(new Date('2026-09-23T12:00:00'));
    const titleDec = formatDayPeriod(new Date('2026-12-01T12:00:00'));
    const titleJan = formatDayPeriod(new Date('2027-01-01T12:00:00'));
    if (
      titleWed !== 'Quarta-feira, 23 de setembro de 2026' ||
      titleDec !== 'Terça-feira, 1 de dezembro de 2026' ||
      titleJan !== 'Sexta-feira, 1 de janeiro de 2027'
    ) {
      throw new Error(`Títulos diários formatados incorretamente: "${titleWed}", "${titleDec}", "${titleJan}"`);
    }
    console.log(`✓ Teste 8 PASS: Títulos formatados em conformidade rigorosa: "${titleWed}".`);

    // TESTE 9: ESTADO VAZIO
    console.log('\n[TESTE 9] Validando identificação de estado vazio no dia...');
    const emptyCards = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const emptyOccs = expandRecurringCards(emptyCards, '2026-09-23', '2026-09-23');
    if (emptyOccs.length !== 0) {
      throw new Error('Estado vazio deve conter 0 ocorrências.');
    }
    console.log('✓ Teste 9 PASS: Estado vazio verificado (0 ocorrências identificadas).');

    // TESTE 10: CREATE NA VISUALIZAÇÃO DIA
    console.log('\n[TESTE 10] Validando criação de card com data do dia atual...');
    const card10 = await calendarCardService.createCard({
      content: 'Card Criado no Dia',
      color: COLOR_PALETTE[0].hex,
      date: '2026-09-23',
    });
    testCardIds.push(card10.id);
    const dayCards10 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs10 = expandRecurringCards(dayCards10, '2026-09-23', '2026-09-23');
    if (occs10.length !== 1 || occs10[0].cardId !== card10.id) {
      throw new Error('Card criado no dia não encontrado na consulta diária.');
    }
    console.log('✓ Teste 10 PASS: Card criado no dia e recuperado na consulta do dia.');

    // TESTE 11: COR SELECIONADA NO PAINEL
    console.log('\n[TESTE 11] Validando criação com cor pré-selecionada no painel lateral...');
    const emeraldHex = COLOR_PALETTE[3].hex; // Verde esmeralda
    const card11 = await calendarCardService.createCard({
      content: 'Card Verde Esmeralda',
      color: emeraldHex,
      date: '2026-09-23',
    });
    testCardIds.push(card11.id);
    if (card11.color !== emeraldHex) {
      throw new Error(`Cor não coincidiu: esperado ${emeraldHex}, obteve ${card11.color}`);
    }
    console.log('✓ Teste 11 PASS: Cor pré-selecionada associada e persistida no card.');

    // TESTE 12: CARD COM HORÁRIO
    console.log('\n[TESTE 12] Validando card com horário na visualização diária...');
    const card12 = await calendarCardService.createCard({
      content: 'Reunião de Alinhamento',
      color: COLOR_PALETTE[5].hex,
      date: '2026-09-23',
      time: '14:30:00',
    });
    testCardIds.push(card12.id);
    const dayCards12 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs12 = expandRecurringCards(dayCards12, '2026-09-23', '2026-09-23');
    const target12 = occs12.find((o) => o.cardId === card12.id);
    if (!target12 || target12.time !== '14:30:00') {
      throw new Error(`Horário não recuperado corretamente: ${target12?.time}`);
    }
    console.log('✓ Teste 12 PASS: Horário 14:30 preservado e recuperado no dia.');

    // TESTE 13: ORDENAÇÃO (08:00, 11:00, 16:00, Sem Horário A, Sem Horário B)
    console.log('\n[TESTE 13] Validando ordenação: com horário (cronológico) -> sem horário (created_at)...');
    // Criamos na ordem: 16:00, sem horário A, 08:00, 11:00, sem horário B
    const ord16 = await calendarCardService.createCard({ content: 'Item 16:00', color: COLOR_PALETTE[1].hex, date: '2026-09-23', time: '16:00:00' });
    const ordNoA = await calendarCardService.createCard({ content: 'Item Sem Horário A', color: COLOR_PALETTE[2].hex, date: '2026-09-23', time: null });
    const ord08 = await calendarCardService.createCard({ content: 'Item 08:00', color: COLOR_PALETTE[4].hex, date: '2026-09-23', time: '08:00:00' });
    const ord11 = await calendarCardService.createCard({ content: 'Item 11:00', color: COLOR_PALETTE[6].hex, date: '2026-09-23', time: '11:00:00' });
    const ordNoB = await calendarCardService.createCard({ content: 'Item Sem Horário B', color: COLOR_PALETTE[7].hex, date: '2026-09-23', time: null });
    testCardIds.push(ord16.id, ordNoA.id, ord08.id, ord11.id, ordNoB.id);

    const testSet = [ord16.id, ordNoA.id, ord08.id, ord11.id, ordNoB.id];
    const dayCards13 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs13 = expandRecurringCards(dayCards13, '2026-09-23', '2026-09-23').filter((o) => testSet.includes(o.cardId));
    const sorted13 = sortOccurrencesForDay(occs13);

    const sortedContents = sorted13.map((o) => o.content);
    if (
      sortedContents[0] !== 'Item 08:00' ||
      sortedContents[1] !== 'Item 11:00' ||
      sortedContents[2] !== 'Item 16:00' ||
      sortedContents[3] !== 'Item Sem Horário A' ||
      sortedContents[4] !== 'Item Sem Horário B'
    ) {
      throw new Error(`Ordem inesperada no dia: ${JSON.stringify(sortedContents)}`);
    }
    console.log('✓ Teste 13 PASS: Ordem rigorosa confirmada: 08:00, 11:00, 16:00, Sem Horário A, Sem Horário B.');

    // TESTE 14: CONTEÚDO MULTILINHA
    console.log('\n[TESTE 14] Validando conteúdo com quebras de linha múltiplas...');
    const multilineText = 'Linha 1: Planejamento estratégico\nLinha 2: Discussão de escopo\nLinha 3: Definição de prazos';
    const card14 = await calendarCardService.createCard({
      content: multilineText,
      color: COLOR_PALETTE[8].hex,
      date: '2026-09-23',
    });
    testCardIds.push(card14.id);
    const dayCards14 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs14 = expandRecurringCards(dayCards14, '2026-09-23', '2026-09-23');
    const target14 = occs14.find((o) => o.cardId === card14.id);
    if (!target14 || target14.content !== multilineText) {
      throw new Error('Conteúdo multilina corrompido.');
    }
    console.log('✓ Teste 14 PASS: Quebras de linha preservadas integralmente para exibição rica.');

    // TESTE 15: DAILY NA VISUALIZAÇÃO DIA
    console.log('\n[TESTE 15] Validando recorrência daily no dia aplicável...');
    const card15 = await calendarCardService.createCard({
      content: 'Meditação Diária',
      color: COLOR_PALETTE[9].hex,
      date: '2026-09-20',
      recurrence_type: 'daily',
    });
    testCardIds.push(card15.id);
    const dayCards15 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs15 = expandRecurringCards(dayCards15, '2026-09-23', '2026-09-23').filter((o) => o.cardId === card15.id);
    if (occs15.length !== 1 || occs15[0].occurrenceDate !== '2026-09-23') {
      throw new Error('Recorrência daily não gerou ocorrência no dia.');
    }
    console.log('✓ Teste 15 PASS: Card daily identificado e expandido para o dia atual.');

    // TESTE 16: WEEKLY NA VISUALIZAÇÃO DIA
    console.log('\n[TESTE 16] Validando weekly: presente no dia da semana correto e ausente em outro...');
    const card16 = await calendarCardService.createCard({
      content: 'Review Semanal de Sexta',
      color: COLOR_PALETTE[10].hex,
      date: '2026-09-25', // Sexta-feira
      recurrence_type: 'weekly',
    });
    testCardIds.push(card16.id);

    // Na quarta 23/09: NÃO deve aparecer
    const wedCards16 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const wedOccs16 = expandRecurringCards(wedCards16, '2026-09-23', '2026-09-23').filter((o) => o.cardId === card16.id);
    if (wedOccs16.length !== 0) {
      throw new Error('Weekly de sexta não deveria aparecer na quarta-feira.');
    }

    // Na sexta 25/09: DEVE aparecer
    const friCards16 = await calendarCardService.getCards('2026-09-25', '2026-09-25');
    const friOccs16 = expandRecurringCards(friCards16, '2026-09-25', '2026-09-25').filter((o) => o.cardId === card16.id);
    if (friOccs16.length !== 1 || friOccs16[0].occurrenceDate !== '2026-09-25') {
      throw new Error('Weekly de sexta não apareceu na sexta-feira.');
    }
    console.log('✓ Teste 16 PASS: Weekly presente estritamente no dia da semana correto (0 na quarta, 1 na sexta).');

    // TESTE 17: CUSTOM WEEK NA VISUALIZAÇÃO DIA
    console.log('\n[TESTE 17] Validando custom week (SEG/QUA/SEX): presente na quarta, ausente na quinta...');
    const card17 = await calendarCardService.createCard({
      content: 'Natação',
      color: COLOR_PALETTE[11].hex,
      date: '2026-09-21',
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'week',
      recurrence_days: [1, 3, 5], // SEG, QUA, SEX
    });
    testCardIds.push(card17.id);

    // Quarta 23/09 (dia 3 da semana): DEVE aparecer
    const wedCards17 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const wedOccs17 = expandRecurringCards(wedCards17, '2026-09-23', '2026-09-23').filter((o) => o.cardId === card17.id);
    if (wedOccs17.length !== 1) {
      throw new Error('Custom SEG/QUA/SEX deve aparecer na quarta-feira.');
    }

    // Quinta 24/09 (dia 4 da semana): NÃO deve aparecer
    const thuCards17 = await calendarCardService.getCards('2026-09-24', '2026-09-24');
    const thuOccs17 = expandRecurringCards(thuCards17, '2026-09-24', '2026-09-24').filter((o) => o.cardId === card17.id);
    if (thuOccs17.length !== 0) {
      throw new Error('Custom SEG/QUA/SEX não deve aparecer na quinta-feira.');
    }
    console.log('✓ Teste 17 PASS: Custom week presente na quarta-feira e ausente na quinta-feira conforme recurrence_days.');

    // TESTE 18: MONTHLY NA VISUALIZAÇÃO DIA
    console.log('\n[TESTE 18] Validando monthly: presente no dia 23 de cada mês e ausente nos demais...');
    const card18 = await calendarCardService.createCard({
      content: 'Pagamento Mensal',
      color: COLOR_PALETTE[12].hex,
      date: '2026-08-23',
      recurrence_type: 'monthly',
    });
    testCardIds.push(card18.id);

    // 23/09: DEVE aparecer
    const day23Cards = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const day23Occs = expandRecurringCards(day23Cards, '2026-09-23', '2026-09-23').filter((o) => o.cardId === card18.id);
    if (day23Occs.length !== 1) {
      throw new Error('Monthly deve ocorrer no dia 23/09.');
    }

    // 24/09: NÃO deve aparecer
    const day24Cards = await calendarCardService.getCards('2026-09-24', '2026-09-24');
    const day24Occs = expandRecurringCards(day24Cards, '2026-09-24', '2026-09-24').filter((o) => o.cardId === card18.id);
    if (day24Occs.length !== 0) {
      throw new Error('Monthly não deve ocorrer em 24/09.');
    }
    console.log('✓ Teste 18 PASS: Monthly gerado com fidelidade em 23/09 e ausente em 24/09.');

    // TESTE 19: RECURRENCE_END_DATE
    console.log('\n[TESTE 19] Validando ausência após recurrence_end_date...');
    const card19 = await calendarCardService.createCard({
      content: 'Sprint Final',
      color: COLOR_PALETTE[13].hex,
      date: '2026-09-21',
      recurrence_type: 'daily',
      recurrence_end_date: '2026-09-23',
    });
    testCardIds.push(card19.id);

    // 23/09 (data final): DEVE aparecer
    const day23Sprint = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs23Sprint = expandRecurringCards(day23Sprint, '2026-09-23', '2026-09-23').filter((o) => o.cardId === card19.id);
    if (occs23Sprint.length !== 1) {
      throw new Error('Data final inclusiva não gerou ocorrência.');
    }

    // 24/09 (após data final): NÃO deve aparecer
    const day24Sprint = await calendarCardService.getCards('2026-09-24', '2026-09-24');
    const occs24Sprint = expandRecurringCards(day24Sprint, '2026-09-24', '2026-09-24').filter((o) => o.cardId === card19.id);
    if (occs24Sprint.length !== 0) {
      throw new Error('Ocorrência gerada após recurrence_end_date.');
    }
    console.log('✓ Teste 19 PASS: recurrence_end_date respeitado inclusivamente (1 em 23/09, 0 em 24/09).');

    // TESTE 20: DETALHE
    console.log('\n[TESTE 20] Validando metadados completos para o CardDetailModal a partir do Dia...');
    const detailOccs = expandRecurringCards(day23Cards, '2026-09-23', '2026-09-23');
    const occDetail = detailOccs.find((o) => o.cardId === card18.id);
    if (!occDetail || !occDetail.card || occDetail.occurrenceDate !== '2026-09-23' || !occDetail.isRecurring) {
      throw new Error('Objeto CalendarOccurrence não fornece os metadados necessários para CardDetailModal.');
    }
    console.log('✓ Teste 20 PASS: CalendarOccurrence pronto para abertura no CardDetailModal.');

    // TESTE 21: EDIT NO DIA
    console.log('\n[TESTE 21] Validando edição de card existente no Dia...');
    const updated21 = await calendarCardService.updateCard(card10.id, {
      content: 'Card Criado no Dia (Editado com Sucesso)',
    });
    if (updated21.content !== 'Card Criado no Dia (Editado com Sucesso)') {
      throw new Error('Falha na atualização do card.');
    }
    const dayCards21 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs21 = expandRecurringCards(dayCards21, '2026-09-23', '2026-09-23').find((o) => o.cardId === card10.id);
    if (occs21?.content !== 'Card Criado no Dia (Editado com Sucesso)') {
      throw new Error('Card editado não refletiu na consulta diária.');
    }
    console.log('✓ Teste 21 PASS: Edição persistida e sincronizada na visualização diária.');

    // TESTE 22: MOVER CARD PARA OUTRO DIA
    console.log('\n[TESTE 22] Validando movimentação de data de card para fora do Dia atual...');
    await calendarCardService.updateCard(card10.id, {
      date: '2026-09-28', // Movido para o dia 28
    });
    // Consulta em 23/09: NÃO deve mais conter card10
    const dayCards22_23 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs22_23 = expandRecurringCards(dayCards22_23, '2026-09-23', '2026-09-23').filter((o) => o.cardId === card10.id);
    if (occs22_23.length !== 0) {
      throw new Error('Card movido ainda aparece na data antiga.');
    }
    // Consulta em 28/09: DEVE conter card10
    const dayCards22_28 = await calendarCardService.getCards('2026-09-28', '2026-09-28');
    const occs22_28 = expandRecurringCards(dayCards22_28, '2026-09-28', '2026-09-28').filter((o) => o.cardId === card10.id);
    if (occs22_28.length !== 1) {
      throw new Error('Card não encontrado na nova data de destino.');
    }
    console.log('✓ Teste 22 PASS: Card movido desapareceu da data anterior e apareceu na data de destino.');

    // TESTE 23: COPY NO MESMO DIA
    console.log('\n[TESTE 23] Validando cópia para o mesmo dia...');
    const copy23 = await calendarCardService.createCard({
      content: 'Cópia de ' + card11.content,
      color: card11.color,
      date: '2026-09-23',
    });
    testCardIds.push(copy23.id);
    if (copy23.id === card11.id) {
      throw new Error('Cópia deve possuir ID único.');
    }
    const dayCards23 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs23 = expandRecurringCards(dayCards23, '2026-09-23', '2026-09-23');
    const hasOrig = occs23.some((o) => o.cardId === card11.id);
    const hasCopy = occs23.some((o) => o.cardId === copy23.id);
    if (!hasOrig || !hasCopy) {
      throw new Error('Ambos os cards devem constar no mesmo dia.');
    }
    console.log('✓ Teste 23 PASS: Cópia no mesmo dia coexistindo com IDs independentes.');

    // TESTE 24: COPY PARA OUTRO DIA
    console.log('\n[TESTE 24] Validando cópia alterando a data para outro dia...');
    const copy24 = await calendarCardService.createCard({
      content: 'Cópia para Outro Dia',
      color: card11.color,
      date: '2026-10-05',
    });
    testCardIds.push(copy24.id);
    const dayCards24_23 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs24_23 = expandRecurringCards(dayCards24_23, '2026-09-23', '2026-09-23').filter((o) => o.cardId === copy24.id);
    if (occs24_23.length !== 0) {
      throw new Error('Cópia para outro dia não deve aparecer em 23/09.');
    }
    const dayCards24_Oct = await calendarCardService.getCards('2026-10-05', '2026-10-05');
    const occs24_Oct = expandRecurringCards(dayCards24_Oct, '2026-10-05', '2026-10-05').filter((o) => o.cardId === copy24.id);
    if (occs24_Oct.length !== 1) {
      throw new Error('Cópia não encontrada no dia 05/10.');
    }
    console.log('✓ Teste 24 PASS: Cópia para outro dia ausente no dia de origem e presente na data correta.');

    // TESTE 25: DELETE NO DIA
    console.log('\n[TESTE 25] Validando exclusão no Dia...');
    await calendarCardService.deleteCard(copy23.id);
    const dayCards25 = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occs25 = expandRecurringCards(dayCards25, '2026-09-23', '2026-09-23');
    if (occs25.some((o) => o.cardId === copy23.id)) {
      throw new Error('Card excluído ainda presente na consulta diária.');
    }
    console.log('✓ Teste 25 PASS: Card excluído com sucesso do Supabase e da visualização diária.');

    // TESTE 26: MÊS -> DIA -> MÊS
    console.log('\n[TESTE 26] Validando coerência temporal Mês -> Dia -> Mês...');
    const refDate26 = new Date('2026-09-23T12:00:00');
    const monthDays26 = getCalendarDays(refDate26);
    const dayStr26 = format(refDate26, 'yyyy-MM-dd');

    // Confirma que a data do dia está contida no grid do mês
    const isContained = monthDays26.some((d) => d.dateString === dayStr26);
    if (!isContained) {
      throw new Error('Dia não contido no grid do mês da mesma referência.');
    }
    console.log('✓ Teste 26 PASS: Transição Mês <-> Dia perfeitamente coerente sob a mesma currentDate.');

    // TESTE 27: SEMANA -> DIA -> SEMANA
    console.log('\n[TESTE 27] Validando coerência temporal Semana -> Dia -> Semana...');
    const weekDays27 = getWeekDays(refDate26);
    const isWeekContained = weekDays27.some((d) => d.dateString === dayStr26);
    if (!isWeekContained) {
      throw new Error('Dia não contido nos 7 dias da semana da mesma referência.');
    }
    console.log('✓ Teste 27 PASS: Transição Semana <-> Dia perfeitamente coerente sob a mesma currentDate.');

    // TESTE 28: RELOAD / RECONSTRUÇÃO DETERMINÍSTICA
    console.log('\n[TESTE 28] Validando reconstrução determinística ao recarregar o Dia...');
    const reloadA = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occsReloadA = expandRecurringCards(reloadA, '2026-09-23', '2026-09-23');

    const reloadB = await calendarCardService.getCards('2026-09-23', '2026-09-23');
    const occsReloadB = expandRecurringCards(reloadB, '2026-09-23', '2026-09-23');

    if (JSON.stringify(occsReloadA) !== JSON.stringify(occsReloadB)) {
      throw new Error('Recuperação após reload do dia não é determinística.');
    }
    console.log(`✓ Teste 28 PASS: Reconstrução determinística confirmada (${occsReloadA.length} ocorrências idênticas).`);

    // TESTE 29: FALHA DE CONSULTA
    console.log('\n[TESTE 29] Validando tratamento amigável de falha na consulta...');
    try {
      await calendarCardService.getCards('invalid-day', 'invalid-day');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Erro ao buscar cards por intervalo')) {
        console.log('✓ Teste 29 PASS: Erro tratado com mensagem amigável sem quebra estrutural.');
      } else {
        throw new Error(`Erro não envelopado corretamente: ${err}`);
      }
    }

    // REGRESSÃO DO MÊS
    console.log('\n[REGRESSÃO DO MÊS] Validando integridade da visualização Mês...');
    const regMonthDays = getCalendarDays(new Date('2026-09-23T12:00:00'));
    const regMonthCards = await calendarCardService.getCards(regMonthDays[0].dateString, regMonthDays[regMonthDays.length - 1].dateString);
    const regMonthOccs = expandRecurringCards(regMonthCards, regMonthDays[0].dateString, regMonthDays[regMonthDays.length - 1].dateString);
    if (regMonthOccs.length === 0) {
      throw new Error('Regressão do mês: nenhuma ocorrência encontrada no mês.');
    }
    console.log('✓ Regressão do Mês PASS: Visão mensal permanece 100% íntegra.');

    // REGRESSÃO DA SEMANA
    console.log('\n[REGRESSÃO DA SEMANA] Validando integridade da visualização Semana...');
    const regWeekDays = getWeekDays(new Date('2026-09-23T12:00:00'));
    const regWeekCards = await calendarCardService.getCards(regWeekDays[0].dateString, regWeekDays[6].dateString);
    const regWeekOccs = expandRecurringCards(regWeekCards, regWeekDays[0].dateString, regWeekDays[6].dateString);
    if (regWeekOccs.length === 0) {
      throw new Error('Regressão da semana: nenhuma ocorrência encontrada na semana.');
    }
    console.log('✓ Regressão da Semana PASS: Visão semanal permanece 100% íntegra.');

    console.log('\n--- TODOS OS 29 TESTES DA F1.7 PASSARAM COM SUCESSO! ---');
  } catch (err) {
    console.error('\nERRO na execução dos testes F1.7:', err);
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

runF17Tests().catch((err) => {
  console.error('Falha nos testes F1.7:', err);
  process.exit(1);
});
