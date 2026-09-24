import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { calendarCardService } from '../src/services/calendarCardService';
import { expandRecurringCards } from '../src/utils/recurrenceUtils';
import { COLOR_PALETTE } from '../src/utils/calendarUtils';
import { CalendarCard } from '../src/types/calendar';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

const testCardIds: string[] = [];

// Helper para obter cor segura
const getColor = (index: number) => COLOR_PALETTE[index % COLOR_PALETTE.length].hex;

async function runF15Tests() {
  console.log('=== INICIANDO VALIDAÇÃO COMPLETA F1.5 — RECORRÊNCIAS FUNCIONAIS ===\n');

  const guard = await createTestGuard(rawClient, 'F1.5');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  try {
    // 0. VALIDAÇÃO DE ACESSO À NOVA COLUNA recurrence_unit
    console.log('[ETAPA 0] Validando acesso à nova coluna recurrence_unit via Supabase client...');
    const testProbe = await calendarCardService.createCard({
      content: 'Probe Column Test',
      color: getColor(0),
      date: '2026-09-01',
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'day',
    });
    testCardIds.push(testProbe.id);
    if (testProbe.recurrence_unit === 'day') {
      console.log('✓ Etapa 0 PASS: recurrence_unit acessível e gravada com sucesso!');
    } else {
      throw new Error('Falha na Etapa 0: recurrence_unit não retornou o valor esperado.');
    }

    // TESTE 1: none -> um registro -> uma ocorrência
    console.log('\n[TESTE 1] Validando card none: 1 registro -> 1 ocorrência...');
    const cardNone = await calendarCardService.createCard({
      content: 'Card None',
      color: getColor(1),
      date: '2026-09-15',
      recurrence_type: 'none',
    });
    testCardIds.push(cardNone.id);
    const occs1 = expandRecurringCards([cardNone], '2026-09-01', '2026-09-30');
    if (occs1.length === 1 && occs1[0].occurrenceDate === '2026-09-15' && !occs1[0].isRecurring) {
      console.log('✓ Teste 1 PASS: Card none gerou exatamente 1 ocorrência na sua data.');
    } else {
      throw new Error(`Falha no Teste 1: esperado 1 ocorrência, obtido ${occs1.length}`);
    }

    // TESTE 2: daily -> 01/09 até 05/09 -> 5 ocorrências
    console.log('\n[TESTE 2] Validando daily de 01/09 a 05/09 -> 5 ocorrências...');
    const cardDailyEnd = await calendarCardService.createCard({
      content: 'Card Diário Finito',
      color: getColor(2),
      date: '2026-09-01',
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: '2026-09-05',
    });
    testCardIds.push(cardDailyEnd.id);
    const occs2 = expandRecurringCards([cardDailyEnd], '2026-09-01', '2026-09-30');
    const dates2 = occs2.map((o) => o.occurrenceDate);
    const expected2 = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    if (
      occs2.length === 5 &&
      JSON.stringify(dates2) === JSON.stringify(expected2) &&
      occs2.every((o) => o.isRecurring)
    ) {
      console.log('✓ Teste 2 PASS: 5 ocorrências diárias consecutivas geradas perfeitamente até o end_date.');
    } else {
      throw new Error(`Falha no Teste 2: obtido ${dates2.join(', ')}`);
    }

    // TESTE 3: daily sem data final -> expandir somente dentro do intervalo solicitado
    console.log('\n[TESTE 3] Validando daily sem data final (expansão restrita ao intervalo visível)...');
    const cardDailyInfinite = await calendarCardService.createCard({
      content: 'Card Diário Infinito',
      color: getColor(3),
      date: '2026-09-10',
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: null,
    });
    testCardIds.push(cardDailyInfinite.id);
    // Intervalo de 5 dias: 2026-09-10 a 2026-09-14
    const occs3 = expandRecurringCards([cardDailyInfinite], '2026-09-10', '2026-09-14');
    if (occs3.length === 5 && occs3[0].occurrenceDate === '2026-09-10' && occs3[4].occurrenceDate === '2026-09-14') {
      console.log('✓ Teste 3 PASS: Apenas 5 ocorrências geradas para a janela de 5 dias solicitada.');
    } else {
      throw new Error(`Falha no Teste 3: esperado 5 ocorrências, obtido ${occs3.length}`);
    }

    // TESTE 4: weekly -> quarta-feira -> somente quartas
    console.log('\n[TESTE 4] Validando weekly: iniciado numa quarta (2026-09-02) -> somente quartas...');
    const cardWeekly = await calendarCardService.createCard({
      content: 'Card Semanal',
      color: getColor(4),
      date: '2026-09-02', // Quarta-feira
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_days: [3], // Quarta-feira
    });
    testCardIds.push(cardWeekly.id);
    const occs4 = expandRecurringCards([cardWeekly], '2026-09-01', '2026-09-30');
    const dates4 = occs4.map((o) => o.occurrenceDate);
    const expected4 = ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'];
    if (JSON.stringify(dates4) === JSON.stringify(expected4)) {
      console.log('✓ Teste 4 PASS: Apenas as quartas-feiras do mês foram geradas.');
    } else {
      throw new Error(`Falha no Teste 4: obtido ${dates4.join(', ')}`);
    }

    // TESTE 5: monthly -> dia 10 -> dia 10 dos meses seguintes
    console.log('\n[TESTE 5] Validando monthly: dia 10 -> dia 10 dos meses seguintes...');
    const cardMonthly = await calendarCardService.createCard({
      content: 'Card Mensal Dia 10',
      color: getColor(5),
      date: '2026-08-10',
      recurrence_type: 'monthly',
      recurrence_interval: 1,
    });
    testCardIds.push(cardMonthly.id);
    // Intervalo de 4 meses: 2026-08-01 a 2026-11-30
    const occs5 = expandRecurringCards([cardMonthly], '2026-08-01', '2026-11-30');
    const dates5 = occs5.map((o) => o.occurrenceDate);
    const expected5 = ['2026-08-10', '2026-09-10', '2026-10-10', '2026-11-10'];
    if (JSON.stringify(dates5) === JSON.stringify(expected5)) {
      console.log('✓ Teste 5 PASS: Ocorrências mensais corretas em 10/08, 10/09, 10/10 e 10/11.');
    } else {
      throw new Error(`Falha no Teste 5: obtido ${dates5.join(', ')}`);
    }

    // TESTE 6: monthly dia 31 -> confirmar que fevereiro/abril/junho etc. são pulados
    console.log('\n[TESTE 6] Validando monthly dia 31: meses sem dia 31 são pulados (sem fallback para último dia)...');
    const cardMonthly31 = await calendarCardService.createCard({
      content: 'Card Mensal Dia 31',
      color: getColor(6),
      date: '2026-01-31',
      recurrence_type: 'monthly',
      recurrence_interval: 1,
    });
    testCardIds.push(cardMonthly31.id);
    // Jan a Mai de 2026: Jan(31), Fev(28 - pula), Mar(31), Abr(30 - pula), Mai(31)
    const occs6 = expandRecurringCards([cardMonthly31], '2026-01-01', '2026-05-31');
    const dates6 = occs6.map((o) => o.occurrenceDate);
    const expected6 = ['2026-01-31', '2026-03-31', '2026-05-31'];
    if (JSON.stringify(dates6) === JSON.stringify(expected6)) {
      console.log('✓ Teste 6 PASS: Fevereiro e Abril foram estritamente pulados, gerando apenas Jan, Mar e Mai!');
    } else {
      throw new Error(`Falha no Teste 6: obtido ${dates6.join(', ')}`);
    }

    // TESTE 7: custom day -> a cada 2 dias
    console.log('\n[TESTE 7] Validando custom day: a cada 2 dias...');
    const cardCustomDay = await calendarCardService.createCard({
      content: 'Card Custom 2 Dias',
      color: getColor(7),
      date: '2026-09-01',
      recurrence_type: 'custom',
      recurrence_interval: 2,
      recurrence_unit: 'day',
      recurrence_end_date: '2026-09-09',
    });
    testCardIds.push(cardCustomDay.id);
    const occs7 = expandRecurringCards([cardCustomDay], '2026-09-01', '2026-09-15');
    const dates7 = occs7.map((o) => o.occurrenceDate);
    const expected7 = ['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07', '2026-09-09'];
    if (JSON.stringify(dates7) === JSON.stringify(expected7)) {
      console.log('✓ Teste 7 PASS: Intervalo de 2 dias gerado com precisão.');
    } else {
      throw new Error(`Falha no Teste 7: obtido ${dates7.join(', ')}`);
    }

    // TESTE 8: custom week -> SEG/QUA/SEX semanal
    console.log('\n[TESTE 8] Validando custom week: SEG/QUA/SEX a cada 1 semana...');
    const cardCustomWeek = await calendarCardService.createCard({
      content: 'Card Custom Seg Qua Sex',
      color: getColor(8),
      date: '2026-09-07', // Segunda-feira
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'week',
      recurrence_days: [1, 3, 5], // Seg, Qua, Sex
      recurrence_end_date: '2026-09-13',
    });
    testCardIds.push(cardCustomWeek.id);
    const occs8 = expandRecurringCards([cardCustomWeek], '2026-09-07', '2026-09-13');
    const dates8 = occs8.map((o) => o.occurrenceDate);
    const expected8 = ['2026-09-07', '2026-09-09', '2026-09-11'];
    if (JSON.stringify(dates8) === JSON.stringify(expected8)) {
      console.log('✓ Teste 8 PASS: Seg, Qua e Sex da semana gerados perfeitamente.');
    } else {
      throw new Error(`Falha no Teste 8: obtido ${dates8.join(', ')}`);
    }

    // TESTE 9: custom week interval 2 -> confirmar alternância correta das semanas
    console.log('\n[TESTE 9] Validando custom week interval 2: semanas alternadas...');
    const cardCustomWeek2 = await calendarCardService.createCard({
      content: 'Card Custom Semana 2',
      color: getColor(9),
      date: '2026-09-07', // Segunda semana 1
      recurrence_type: 'custom',
      recurrence_interval: 2,
      recurrence_unit: 'week',
      recurrence_days: [1], // Segundas a cada 2 semanas
    });
    testCardIds.push(cardCustomWeek2.id);
    const occs9 = expandRecurringCards([cardCustomWeek2], '2026-09-01', '2026-09-30');
    const dates9 = occs9.map((o) => o.occurrenceDate);
    // 07/09 (Semana 1), 14/09 (pula semana 2), 21/09 (Semana 3), 28/09 (pula semana 4)
    const expected9 = ['2026-09-07', '2026-09-21'];
    if (JSON.stringify(dates9) === JSON.stringify(expected9)) {
      console.log('✓ Teste 9 PASS: Alternância de 2 semanas confirmada (07/09 e 21/09).');
    } else {
      throw new Error(`Falha no Teste 9: obtido ${dates9.join(', ')}`);
    }

    // TESTE 10: custom month -> a cada 2 meses
    console.log('\n[TESTE 10] Validando custom month: a cada 2 meses...');
    const cardCustomMonth2 = await calendarCardService.createCard({
      content: 'Card Custom 2 Meses',
      color: getColor(10),
      date: '2026-05-15',
      recurrence_type: 'custom',
      recurrence_interval: 2,
      recurrence_unit: 'month',
    });
    testCardIds.push(cardCustomMonth2.id);
    const occs10 = expandRecurringCards([cardCustomMonth2], '2026-05-01', '2026-11-30');
    const dates10 = occs10.map((o) => o.occurrenceDate);
    // Maio, Julho, Setembro, Novembro
    const expected10 = ['2026-05-15', '2026-07-15', '2026-09-15', '2026-11-15'];
    if (JSON.stringify(dates10) === JSON.stringify(expected10)) {
      console.log('✓ Teste 10 PASS: Ocorrências a cada 2 meses geradas com exatidão.');
    } else {
      throw new Error(`Falha no Teste 10: obtido ${dates10.join(', ')}`);
    }

    // TESTE 11: recurrence_end_date -> inclusão da data final e ausência posterior
    console.log('\n[TESTE 11] Validando inclusão estrita de recurrence_end_date e ausência posterior...');
    const cardEndInclusive = await calendarCardService.createCard({
      content: 'Card End Inclusive',
      color: getColor(11),
      date: '2026-09-01',
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: '2026-09-03',
    });
    testCardIds.push(cardEndInclusive.id);
    const occs11 = expandRecurringCards([cardEndInclusive], '2026-09-01', '2026-09-10');
    const dates11 = occs11.map((o) => o.occurrenceDate);
    if (dates11.includes('2026-09-03') && !dates11.includes('2026-09-04') && occs11.length === 3) {
      console.log('✓ Teste 11 PASS: recurrence_end_date é inclusivo (03/09 incluído, 04/09 ausente).');
    } else {
      throw new Error(`Falha no Teste 11: obtido ${dates11.join(', ')}`);
    }

    // TESTE 12: série iniciada antes do mês -> confirmar renderização das ocorrências do mês atual
    console.log('\n[TESTE 12] Validando série iniciada antes do mês visível...');
    const cardPriorMonth = await calendarCardService.createCard({
      content: 'Card Iniciado em Julho',
      color: getColor(0),
      date: '2026-07-01',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    testCardIds.push(cardPriorMonth.id);
    const fetchedForSept = await calendarCardService.getCards('2026-09-01', '2026-09-30');
    const hasPriorCard = fetchedForSept.some((c) => c.id === cardPriorMonth.id);
    const occs12 = expandRecurringCards(
      fetchedForSept.filter((c) => c.id === cardPriorMonth.id),
      '2026-09-01',
      '2026-09-30'
    );
    if (hasPriorCard && occs12.length === 30 && occs12[0].occurrenceDate === '2026-09-01') {
      console.log('✓ Teste 12 PASS: Série iniciada em julho foi recuperada e gerou as 30 ocorrências de setembro.');
    } else {
      throw new Error(`Falha no Teste 12: hasPriorCard=${hasPriorCard}, occs=${occs12.length}`);
    }

    // TESTE 13: não gerar ocorrência antes da date base
    console.log('\n[TESTE 13] Validando que nenhuma ocorrência é gerada antes de card.date...');
    const cardMidMonth = await calendarCardService.createCard({
      content: 'Card Início 15/09',
      color: getColor(1),
      date: '2026-09-15',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    testCardIds.push(cardMidMonth.id);
    const occs13 = expandRecurringCards([cardMidMonth], '2026-09-01', '2026-09-30');
    const hasBeforeBase = occs13.some((o) => o.occurrenceDate < '2026-09-15');
    if (!hasBeforeBase && occs13[0].occurrenceDate === '2026-09-15') {
      console.log('✓ Teste 13 PASS: Nenhuma ocorrência foi gerada antes da data-base 15/09.');
    } else {
      throw new Error('Falha no Teste 13: ocorrências geradas antes da data-base.');
    }

    // TESTE 14: alterar data-base -> confirmar recálculo
    console.log('\n[TESTE 14] Validando alteração de data-base e recálculo da série...');
    const cardChangeBase = await calendarCardService.createCard({
      content: 'Card Altera Base',
      color: getColor(2),
      date: '2026-09-10',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    testCardIds.push(cardChangeBase.id);
    await calendarCardService.updateCard(cardChangeBase.id, {
      date: '2026-09-20',
    });
    const updatedBaseCard = await calendarCardService.getCardById(cardChangeBase.id);
    const occs14 = expandRecurringCards([updatedBaseCard], '2026-09-01', '2026-09-30');
    const firstOcc = occs14[0].occurrenceDate;
    if (firstOcc === '2026-09-20' && occs14.length === 11) {
      console.log('✓ Teste 14 PASS: Série recalculada a partir da nova data 20/09 (ocorrências anteriores a 20/09 desapareceram).');
    } else {
      throw new Error(`Falha no Teste 14: firstOcc=${firstOcc}`);
    }

    // TESTE 15: recorrente -> none -> confirmar desaparecimento das ocorrências futuras
    console.log('\n[TESTE 15] Validando transição recorrente -> none...');
    const cardToNone = await calendarCardService.createCard({
      content: 'Card Vira None',
      color: getColor(3),
      date: '2026-09-05',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    testCardIds.push(cardToNone.id);
    await calendarCardService.updateCard(cardToNone.id, {
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_unit: null,
      recurrence_days: null,
      recurrence_end_date: null,
    });
    const cardNowNone = await calendarCardService.getCardById(cardToNone.id);
    const occs15 = expandRecurringCards([cardNowNone], '2026-09-01', '2026-09-30');
    if (occs15.length === 1 && occs15[0].occurrenceDate === '2026-09-05' && !occs15[0].isRecurring) {
      console.log('✓ Teste 15 PASS: Card transicionado para none; todas as ocorrências futuras desapareceram.');
    } else {
      throw new Error(`Falha no Teste 15: occs=${occs15.length}`);
    }

    // TESTE 16: none -> daily -> confirmar geração
    console.log('\n[TESTE 16] Validando transição none -> daily...');
    const cardToDaily = await calendarCardService.createCard({
      content: 'Card Vira Daily',
      color: getColor(4),
      date: '2026-09-25',
      recurrence_type: 'none',
    });
    testCardIds.push(cardToDaily.id);
    await calendarCardService.updateCard(cardToDaily.id, {
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    const cardNowDaily = await calendarCardService.getCardById(cardToDaily.id);
    const occs16 = expandRecurringCards([cardNowDaily], '2026-09-01', '2026-09-30');
    if (occs16.length === 6 && occs16[0].occurrenceDate === '2026-09-25' && occs16[5].occurrenceDate === '2026-09-30') {
      console.log('✓ Teste 16 PASS: Card none transformado em daily; gerou 6 ocorrências de 25 a 30.');
    } else {
      throw new Error(`Falha no Teste 16: occs=${occs16.length}`);
    }

    // TESTE 17: editar série -> confirmar que existe apenas UM registro no banco
    console.log('\n[TESTE 17] Validando edição da série: banco mantém apenas 1 registro...');
    const cardSingleSeries = await calendarCardService.createCard({
      content: 'Série Conteúdo Original',
      color: getColor(5),
      date: '2026-09-01',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    testCardIds.push(cardSingleSeries.id);
    await calendarCardService.updateCard(cardSingleSeries.id, {
      content: 'Série Conteúdo Editado',
    });
    const { data: dbRecords } = await rawClient
      .from('calendar_cards')
      .select('id, content')
      .eq('id', cardSingleSeries.id);
    if (dbRecords?.length === 1 && dbRecords[0].content === 'Série Conteúdo Editado') {
      console.log('✓ Teste 17 PASS: Conteúdo atualizado mantendo estritamente 1 único registro no banco.');
    } else {
      throw new Error('Falha no Teste 17');
    }

    // TESTE 18: excluir série -> confirmar remoção de todas as ocorrências virtuais
    console.log('\n[TESTE 18] Validando exclusão da série: todas as ocorrências desaparecem...');
    const cardToDeleteSeries = await calendarCardService.createCard({
      content: 'Série Para Deletar',
      color: getColor(6),
      date: '2026-09-01',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });
    await calendarCardService.deleteCard(cardToDeleteSeries.id);
    const fetchedPostDelete = await calendarCardService.getCards('2026-09-01', '2026-09-30');
    const occs18 = expandRecurringCards(
      fetchedPostDelete.filter((c) => c.id === cardToDeleteSeries.id),
      '2026-09-01',
      '2026-09-30'
    );
    if (occs18.length === 0) {
      console.log('✓ Teste 18 PASS: Exclusão removeu o registro-base e 100% das ocorrências virtuais sumiram.');
    } else {
      throw new Error('Falha no Teste 18');
    }

    // TESTE 19: copiar série -> confirmar dois registros-base independentes
    console.log('\n[TESTE 19] Validando cópia de série: 2 registros-base independentes...');
    const cardOriginalSeries = await calendarCardService.createCard({
      content: 'Série Original Copiada',
      color: getColor(7),
      date: '2026-09-01',
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_days: [2], // Terça-feira
    });
    testCardIds.push(cardOriginalSeries.id);
    const copiedSeries = await calendarCardService.createCard({
      content: cardOriginalSeries.content,
      color: cardOriginalSeries.color,
      date: cardOriginalSeries.date,
      time: cardOriginalSeries.time,
      recurrence_type: cardOriginalSeries.recurrence_type,
      recurrence_interval: cardOriginalSeries.recurrence_interval,
      recurrence_unit: cardOriginalSeries.recurrence_unit,
      recurrence_days: cardOriginalSeries.recurrence_days,
      recurrence_end_date: cardOriginalSeries.recurrence_end_date,
    });
    testCardIds.push(copiedSeries.id);
    if (copiedSeries.id !== cardOriginalSeries.id && copiedSeries.recurrence_type === 'weekly') {
      console.log(`✓ Teste 19 PASS: Cópia criou série independente (UUID ${copiedSeries.id}). Original mantido.`);
    } else {
      throw new Error('Falha no Teste 19');
    }

    // TESTE 20: timezone -> datas devem permanecer exatamente no dia esperado
    console.log('\n[TESTE 20] Validando timezone: sem conversão UTC ou alteração de dia...');
    const cardTimezone = await calendarCardService.createCard({
      content: 'Card Timezone Check',
      color: getColor(8),
      date: '2026-09-20',
      time: '23:30',
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: '2026-09-22',
    });
    testCardIds.push(cardTimezone.id);
    const occs20 = expandRecurringCards([cardTimezone], '2026-09-20', '2026-09-22');
    const dates20 = occs20.map((o) => o.occurrenceDate);
    if (
      dates20[0] === '2026-09-20' &&
      dates20[1] === '2026-09-21' &&
      dates20[2] === '2026-09-22'
    ) {
      console.log('✓ Teste 20 PASS: Datas mantiveram exatamente o padrão 2026-09-20, 2026-09-21 e 2026-09-22.');
    } else {
      throw new Error(`Falha no Teste 20: obtido ${dates20.join(', ')}`);
    }

    // TESTE 21: custom sem recurrence_unit -> deve ser rejeitado pela constraint
    console.log('\n[TESTE 21] Validando rejeição de custom sem recurrence_unit...');
    const { error: insertErr21 } = await rawClient.from('calendar_cards').insert({
      content: 'Custom Sem Unidade',
      color: getColor(9),
      date: '2026-09-01',
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: null,
    });
    if (insertErr21 && insertErr21.message.includes('check_recurrence_unit')) {
      console.log('✓ Teste 21 PASS: Banco rejeitou custom sem recurrence_unit (check_recurrence_unit acionada).');
    } else {
      throw new Error('Falha no Teste 21: constraint não foi acionada.');
    }

    // TESTE 22: custom week sem dias -> deve ser rejeitado pela validação/constraint
    console.log('\n[TESTE 22] Validando rejeição de custom week sem dias selecionados...');
    let serviceRejected22 = false;
    try {
      await calendarCardService.createCard({
        content: 'Custom Week Sem Dias',
        color: getColor(10),
        date: '2026-09-01',
        recurrence_type: 'custom',
        recurrence_interval: 1,
        recurrence_unit: 'week',
        recurrence_days: [],
      });
    } catch {
      serviceRejected22 = true;
    }

    const { error: insertErr22 } = await rawClient.from('calendar_cards').insert({
      content: 'Custom Week Dias Fora de Faixa',
      color: getColor(10),
      date: '2026-09-01',
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_unit: 'week',
      recurrence_days: [8],
    });

    if (serviceRejected22 && insertErr22 && insertErr22.message.includes('check_recurrence_days')) {
      console.log('✓ Teste 22 PASS: Rejeição de custom week sem dias validada no service e constraint check_recurrence_days acionada no banco.');
    } else {
      throw new Error(`Falha no Teste 22: serviceRejected=${serviceRejected22}, constraint=${insertErr22?.message}`);
    }

    // TESTE 23: intervalo 0 -> deve ser rejeitado pela constraint
    console.log('\n[TESTE 23] Validando rejeição de recurrence_interval = 0...');
    const { error: insertErr23 } = await rawClient.from('calendar_cards').insert({
      content: 'Intervalo Zero',
      color: getColor(11),
      date: '2026-09-01',
      recurrence_type: 'daily',
      recurrence_interval: 0,
    });
    if (insertErr23 && insertErr23.message.includes('check_recurrence_interval')) {
      console.log('✓ Teste 23 PASS: Banco rejeitou recurrence_interval < 1 (check_recurrence_interval acionada).');
    } else {
      throw new Error('Falha no Teste 23');
    }

    // TESTE 24: data final anterior à inicial -> deve ser rejeitada pela constraint
    console.log('\n[TESTE 24] Validando rejeição de recurrence_end_date anterior à date...');
    const { error: insertErr24 } = await rawClient.from('calendar_cards').insert({
      content: 'End Date Anterior',
      color: getColor(0),
      date: '2026-09-10',
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: '2026-09-05',
    });
    if (insertErr24 && insertErr24.message.includes('check_recurrence_end_date')) {
      console.log('✓ Teste 24 PASS: Banco rejeitou end_date anterior à date inicial (check_recurrence_end_date acionada).');
    } else {
      throw new Error('Falha no Teste 24');
    }

    // TESTE 25: reload/navegação -> confirmar reconstrução idêntica das ocorrências a partir do Supabase
    console.log('\n[TESTE 25] Validando reconstrução idêntica das ocorrências em reload/navegação...');
    const fetchedAllSept = await calendarCardService.getCards('2026-09-01', '2026-09-30');
    const occsA = expandRecurringCards(fetchedAllSept, '2026-09-01', '2026-09-30');
    const fetchedReload = await calendarCardService.getCards('2026-09-01', '2026-09-30');
    const occsB = expandRecurringCards(fetchedReload, '2026-09-01', '2026-09-30');
    if (
      occsA.length === occsB.length &&
      JSON.stringify(occsA.map((o) => o.occurrenceKey)) === JSON.stringify(occsB.map((o) => o.occurrenceKey))
    ) {
      console.log(`✓ Teste 25 PASS: Reconstrução determinística confirmada (${occsA.length} ocorrências idênticas geradas em ambas as consultas).`);
    } else {
      throw new Error('Falha no Teste 25');
    }

    console.log('\n--- TODOS OS 25 TESTES PASSARAM COM SUCESSO! ---');
  } catch (err) {
    console.error('ERRO na execução dos testes F1.5:', err);
  } finally {
    // 28. LIMPEZA DOS DADOS DE TESTE (FAIL-CLOSED)
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

runF15Tests();
