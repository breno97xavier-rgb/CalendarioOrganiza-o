import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { calendarCardService } from '../src/services/calendarCardService';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

interface TestResults {
  connection: boolean;
  selectAnon: boolean;
  insertSimple: boolean;
  cardWithTime: boolean;
  recurrenceDaily: boolean;
  recurrenceWeekly: boolean;
  getCardsInterval: boolean;
  recurringBeforeInterval: boolean;
  updateCard: boolean;
  triggerUpdatedAt: boolean;
  duplicateCard: boolean;
  deleteCard: boolean;
  constraintContentEmpty: boolean;
  constraintColorEmpty: boolean;
  constraintRecurrenceType: boolean;
  constraintRecurrenceInterval: boolean;
  constraintRecurrenceDays: boolean;
  constraintRecurrenceEndDate: boolean;
  cleanup: boolean;
}

const results: TestResults = {
  connection: false,
  selectAnon: false,
  insertSimple: false,
  cardWithTime: false,
  recurrenceDaily: false,
  recurrenceWeekly: false,
  getCardsInterval: false,
  recurringBeforeInterval: false,
  updateCard: false,
  triggerUpdatedAt: false,
  duplicateCard: false,
  deleteCard: false,
  constraintContentEmpty: false,
  constraintColorEmpty: false,
  constraintRecurrenceType: false,
  constraintRecurrenceInterval: false,
  constraintRecurrenceDays: false,
  constraintRecurrenceEndDate: false,
  cleanup: false,
};

const allCreatedIds: string[] = [];

async function main() {
  console.log('=== INICIANDO VALIDAÇÃO COMPLETA F1.2 PÓS-CONEXÃO ===\n');

  const guard = await createTestGuard(rawClient, 'F1.2');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  try {
    // 1. Conexão & SELECT inicial via cliente anon
    console.log('[1] Testando conexão e SELECT via cliente anon...');
    const { data: initialSelect, error: connError } = await rawClient
      .from('calendar_cards')
      .select('id')
      .limit(1);

    if (connError) {
      console.error('ERRO na conexão/SELECT:', connError);
      return;
    }

    results.connection = true;
    results.selectAnon = true;
    console.log('✓ Conexão estabelecida e SELECT executado com sucesso.');

    // 2. TESTE 1: Card simples (sem horário, sem recorrência)
    console.log('\n[2] TESTE 1: Inserindo card simples...');
    const card1 = await calendarCardService.createCard({
      content: 'Card Simples de Teste',
      color: '#DC2626',
      date: '2026-09-15',
    });

    if (
      card1.id &&
      card1.content === 'Card Simples de Teste' &&
      card1.created_at &&
      card1.updated_at &&
      card1.recurrence_type === 'none'
    ) {
      allCreatedIds.push(card1.id);
      results.insertSimple = true;
      console.log('✓ Card simples criado com ID:', card1.id);
    } else {
      console.error('Falha na validação do Card 1:', card1);
    }

    // 3. TESTE 2: Card com horário
    console.log('\n[3] TESTE 2: Inserindo card com horário...');
    const card2 = await calendarCardService.createCard({
      content: 'Card com Horário de Teste',
      color: '#2563EB',
      date: '2026-09-16',
      time: '14:30:00',
    });

    if (card2.id && card2.time?.startsWith('14:30')) {
      allCreatedIds.push(card2.id);
      results.cardWithTime = true;
      console.log('✓ Card com horário criado com sucesso. Time:', card2.time);
    } else {
      console.error('Falha no Card com Horário:', card2);
    }

    // 4. TESTE 3: Recorrência daily
    console.log('\n[4] TESTE 3: Inserindo card com recorrência daily...');
    const card3 = await calendarCardService.createCard({
      content: 'Card Recorrência Diária',
      color: '#16A34A',
      date: '2026-09-10',
      recurrence_type: 'daily',
      recurrence_interval: 1,
    });

    if (card3.id && card3.recurrence_type === 'daily' && card3.recurrence_interval === 1) {
      allCreatedIds.push(card3.id);
      results.recurrenceDaily = true;
      console.log('✓ Card daily criado com sucesso.');
    } else {
      console.error('Falha no Card Daily:', card3);
    }

    // 5. TESTE 4: Recorrência weekly com recurrence_days
    console.log('\n[5] TESTE 4: Inserindo card weekly com recurrence_days...');
    // Série iniciada antes do intervalo de setembro (ex: 2026-08-15) e com término em 2026-12-31
    const card4 = await calendarCardService.createCard({
      content: 'Card Recorrência Semanal Antes do Intervalo',
      color: '#7C3AED',
      date: '2026-08-15',
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_days: [1, 3, 5],
      recurrence_end_date: '2026-12-31',
    });

    if (
      card4.id &&
      card4.recurrence_type === 'weekly' &&
      Array.isArray(card4.recurrence_days) &&
      card4.recurrence_days.length === 3 &&
      card4.recurrence_days[0] === 1 &&
      card4.recurrence_days[1] === 3 &&
      card4.recurrence_days[2] === 5
    ) {
      allCreatedIds.push(card4.id);
      results.recurrenceWeekly = true;
      console.log('✓ Card weekly criado com recurrence_days:', card4.recurrence_days);
    } else {
      console.error('Falha no Card Weekly:', card4);
    }

    // 6. TESTE 5: Consulta por intervalo e validação de série iniciada antes
    console.log('\n[6] TESTE 5: Consultando intervalo de Setembro (2026-09-01 a 2026-09-30)...');
    const intervalCards = await calendarCardService.getCards('2026-09-01', '2026-09-30');
    console.log(`Cards recuperados no intervalo: ${intervalCards.length}`);

    const hasCard1 = intervalCards.some((c) => c.id === card1.id);
    const hasCard4 = intervalCards.some((c) => c.id === card4.id);

    if (hasCard1) {
      results.getCardsInterval = true;
      console.log('✓ A) Card não-recorrente de Setembro recuperado corretamente.');
    } else {
      console.error('X Card 1 não encontrado no intervalo!');
    }

    if (hasCard4) {
      results.recurringBeforeInterval = true;
      console.log('✓ B) Série recorrente iniciada em Agosto recuperada corretamente no intervalo de Setembro.');
    } else {
      console.error('X Card 4 (recorrente de Agosto) não encontrado no intervalo!');
    }

    // 7. TESTE 6: UPDATE e validação da trigger updated_at
    console.log('\n[7] TESTE 6: Atualizando registro e validando trigger updated_at...');
    // Aguarda 1.2 segundos para garantir diferença inequívoca de timestamp
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const updated = await calendarCardService.updateCard(card1.id, {
      content: 'Card Simples - Conteúdo Modificado',
      color: '#EA580C',
    });

    const createdAtMs = new Date(card1.created_at).getTime();
    const updatedAtMs = new Date(updated.updated_at).getTime();

    if (updated.content === 'Card Simples - Conteúdo Modificado' && updatedAtMs > createdAtMs) {
      results.updateCard = true;
      results.triggerUpdatedAt = true;
      console.log(
        `✓ Card atualizado. created_at: ${card1.created_at}, updated_at: ${updated.updated_at} (delta: ${
          updatedAtMs - createdAtMs
        }ms)`
      );
    } else {
      console.error('Falha na atualização ou trigger updated_at:', {
        card1_createdAt: card1.created_at,
        updated_updatedAt: updated.updated_at,
      });
    }

    // 8. TESTE 7: duplicateCard
    console.log('\n[8] TESTE 7: Duplicando card...');
    const dupCard = await calendarCardService.duplicateCard(card2.id);
    if (dupCard.id && dupCard.id !== card2.id && dupCard.content === card2.content) {
      allCreatedIds.push(dupCard.id);
      results.duplicateCard = true;
      console.log(`✓ Card duplicado. Novo ID: ${dupCard.id} (Original: ${card2.id})`);
    } else {
      console.error('Falha na duplicação:', dupCard);
    }

    // 9. TESTE 8: DELETE individual
    console.log('\n[9] TESTE 8: Testando exclusão de um registro...');
    await calendarCardService.deleteCard(dupCard.id);
    const { data: checkDeleted } = await rawClient
      .from('calendar_cards')
      .select('id')
      .eq('id', dupCard.id)
      .maybeSingle();

    if (!checkDeleted) {
      results.deleteCard = true;
      console.log('✓ Registro duplicado excluído com sucesso.');
      // Remove do array de criados pois já foi apagado
      const idx = allCreatedIds.indexOf(dupCard.id);
      if (idx !== -1) allCreatedIds.splice(idx, 1);
    } else {
      console.error('Registro ainda existe após delete:', checkDeleted);
    }

    // 10. VALIDAÇÃO DE CONSTRAINTS (A até F)
    console.log('\n[10] Validando Constraints (devem rejeitar inserções inválidas)...');

    // A) content vazio ou apenas espaços
    console.log('  Validando Constraint A: content vazio...');
    const { error: errA } = await rawClient.from('calendar_cards').insert([
      { content: '   ', color: '#DC2626', date: '2026-09-20' },
    ]);
    if (errA) {
      results.constraintContentEmpty = true;
      console.log('  ✓ Rejeitado corretamente pelo PostgreSQL:', errA.message);
    } else {
      console.error('  X FALHA: banco aceitou content vazio!');
    }

    // B) color vazia ou apenas espaços
    console.log('  Validando Constraint B: color vazia...');
    const { error: errB } = await rawClient.from('calendar_cards').insert([
      { content: 'Texto válido', color: '  ', date: '2026-09-20' },
    ]);
    if (errB) {
      results.constraintColorEmpty = true;
      console.log('  ✓ Rejeitado corretamente pelo PostgreSQL:', errB.message);
    } else {
      console.error('  X FALHA: banco aceitou color vazia!');
    }

    // C) recurrence_type inválido
    console.log('  Validando Constraint C: recurrence_type inválido...');
    const { error: errC } = await rawClient.from('calendar_cards').insert([
      { content: 'Texto válido', color: '#DC2626', date: '2026-09-20', recurrence_type: 'yearly' },
    ]);
    if (errC) {
      results.constraintRecurrenceType = true;
      console.log('  ✓ Rejeitado corretamente pelo PostgreSQL:', errC.message);
    } else {
      console.error('  X FALHA: banco aceitou recurrence_type inválido!');
    }

    // D) recurrence_interval = 0
    console.log('  Validando Constraint D: recurrence_interval = 0...');
    const { error: errD } = await rawClient.from('calendar_cards').insert([
      { content: 'Texto válido', color: '#DC2626', date: '2026-09-20', recurrence_interval: 0 },
    ]);
    if (errD) {
      results.constraintRecurrenceInterval = true;
      console.log('  ✓ Rejeitado corretamente pelo PostgreSQL:', errD.message);
    } else {
      console.error('  X FALHA: banco aceitou recurrence_interval = 0!');
    }

    // E) recurrence_days contendo número fora de 1-7 (ex: [0, 8])
    console.log('  Validando Constraint E: recurrence_days contendo valores fora de 1-7...');
    const { error: errE } = await rawClient.from('calendar_cards').insert([
      {
        content: 'Texto válido',
        color: '#DC2626',
        date: '2026-09-20',
        recurrence_type: 'weekly',
        recurrence_days: [1, 8],
      },
    ]);
    if (errE) {
      results.constraintRecurrenceDays = true;
      console.log('  ✓ Rejeitado corretamente pelo PostgreSQL:', errE.message);
    } else {
      console.error('  X FALHA: banco aceitou recurrence_days com valor 8!');
    }

    // F) recurrence_end_date anterior à date
    console.log('  Validando Constraint F: recurrence_end_date anterior à date...');
    const { error: errF } = await rawClient.from('calendar_cards').insert([
      {
        content: 'Texto válido',
        color: '#DC2626',
        date: '2026-09-20',
        recurrence_type: 'daily',
        recurrence_end_date: '2026-09-10', // Anterior à date
      },
    ]);
    if (errF) {
      results.constraintRecurrenceEndDate = true;
      console.log('  ✓ Rejeitado corretamente pelo PostgreSQL:', errF.message);
    } else {
      console.error('  X FALHA: banco aceitou recurrence_end_date anterior à date!');
    }
  } catch (err) {
    console.error('Erro inesperado durante a suíte de testes:', err);
  } finally {
    // 11. LIMPEZA FINAL (FAIL-CLOSED)
    guard.registerCreatedIds(allCreatedIds);
    console.log('\n[11] Realizando limpeza fail-closed de todos os registros de teste...');
    const cleanupResult = await guard.cleanup();
    console.log(`Registros de teste excluídos: ${cleanupResult.deletedCount}`);

    const dataProt = await guard.verifyDataProtection();
    const testClean = await guard.verifyTestCleanup();

    if (dataProt.preserved && testClean.allRemoved) {
      results.cleanup = true;
      console.log(`✓ Proteção confirmada: dados preexistentes (${guard.preExistingIds.size}) preservados e cards de teste removidos.`);
    } else {
      console.error('AVISO: Falha na verificação de proteção ou limpeza:', { dataProt, testClean });
    }

    console.log('\n=== RESULTADO CONSOLIDADO ===');
    console.log(JSON.stringify(results, null, 2));
  }
}

main();
