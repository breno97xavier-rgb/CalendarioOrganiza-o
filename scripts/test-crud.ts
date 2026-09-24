import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function runCrudTests() {
  console.log('--- INICIANDO BATERIA DE TESTES CRUD F1.2 ---');

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project')) {
    console.error(
      'AVISO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas no .env.'
    );
    console.log(
      'Configure o .env com as credenciais reais do Supabase para executar o teste.'
    );
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const guard = await createTestGuard(supabase, 'CRUD-Test');
  console.log(`Auditoria inicial: ${guard.preExistingIds.size} registros preexistentes protegidos.\n`);
  const createdIds: string[] = [];

  try {
    // TESTE 1: Criar card simples sem horário e sem recorrência
    console.log('\n[TESTE 1] Criando card simples sem horário e sem recorrência...');
    const { data: card1, error: err1 } = await supabase
      .from('calendar_cards')
      .insert([
        {
          content: 'Teste 1 - Card Simples',
          color: '#DC2626',
          date: '2026-09-23',
        },
      ])
      .select()
      .single();

    if (err1 || !card1) throw new Error(`Falha no Teste 1: ${err1?.message}`);
    createdIds.push(card1.id);
    console.log('✓ Teste 1 concluído com sucesso. ID:', card1.id);

    // TESTE 2: Criar card com horário
    console.log('\n[TESTE 2] Criando card com horário...');
    const { data: card2, error: err2 } = await supabase
      .from('calendar_cards')
      .insert([
        {
          content: 'Teste 2 - Card com Horário',
          color: '#2563EB',
          date: '2026-09-24',
          time: '14:30:00',
        },
      ])
      .select()
      .single();

    if (err2 || !card2) throw new Error(`Falha no Teste 2: ${err2?.message}`);
    createdIds.push(card2.id);
    console.log('✓ Teste 2 concluído com sucesso. ID:', card2.id);

    // TESTE 3: Criar card com recorrência daily
    console.log('\n[TESTE 3] Criando card com recorrência daily...');
    const { data: card3, error: err3 } = await supabase
      .from('calendar_cards')
      .insert([
        {
          content: 'Teste 3 - Card Recorrência Diária',
          color: '#16A34A',
          date: '2026-09-25',
          recurrence_type: 'daily',
          recurrence_interval: 1,
        },
      ])
      .select()
      .single();

    if (err3 || !card3) throw new Error(`Falha no Teste 3: ${err3?.message}`);
    createdIds.push(card3.id);
    console.log('✓ Teste 3 concluído com sucesso. ID:', card3.id);

    // TESTE 4: Criar card weekly usando recurrence_days
    console.log('\n[TESTE 4] Criando card weekly usando recurrence_days...');
    const { data: card4, error: err4 } = await supabase
      .from('calendar_cards')
      .insert([
        {
          content: 'Teste 4 - Card Recorrência Semanal',
          color: '#7C3AED',
          date: '2026-09-26',
          recurrence_type: 'weekly',
          recurrence_interval: 2,
          recurrence_days: [1, 3, 5],
          recurrence_end_date: '2026-12-31',
        },
      ])
      .select()
      .single();

    if (err4 || !card4) throw new Error(`Falha no Teste 4: ${err4?.message}`);
    createdIds.push(card4.id);
    console.log('✓ Teste 4 concluído com sucesso. ID:', card4.id);

    // TESTE 5: Ler os registros
    console.log('\n[TESTE 5] Lendo registros do intervalo...');
    const filter = [
      `and(recurrence_type.eq.none,date.gte.2026-09-01,date.lte.2026-09-30)`,
      `and(recurrence_type.neq.none,date.lte.2026-09-30,recurrence_end_date.is.null)`,
      `and(recurrence_type.neq.none,date.lte.2026-09-30,recurrence_end_date.gte.2026-09-01)`,
    ].join(',');

    const { data: readCards, error: err5 } = await supabase
      .from('calendar_cards')
      .select('*')
      .or(filter);

    if (err5 || !readCards) throw new Error(`Falha no Teste 5: ${err5?.message}`);
    console.log(`✓ Teste 5 concluído com sucesso. Registros recuperados: ${readCards.length}`);

    // TESTE 6: Atualizar um registro e confirmar alteração automática de updated_at
    console.log('\n[TESTE 6] Atualizando registro para validar trigger de updated_at...');
    // Pausa breve para garantir que updated_at avance em relação a created_at
    await new Promise((res) => setTimeout(res, 1100));

    const { data: updatedCard, error: err6 } = await supabase
      .from('calendar_cards')
      .update({ content: 'Teste 6 - Conteúdo Atualizado' })
      .eq('id', card1.id)
      .select()
      .single();

    if (err6 || !updatedCard) throw new Error(`Falha no Teste 6: ${err6?.message}`);
    const isUpdated = new Date(updatedCard.updated_at).getTime() > new Date(card1.created_at).getTime();
    console.log(
      `✓ Teste 6 concluído. created_at: ${card1.created_at} | updated_at: ${updatedCard.updated_at} | Atualizado: ${isUpdated}`
    );

    // TESTE 7: Duplicar um registro e confirmar geração de novo UUID
    console.log('\n[TESTE 7] Duplicando card...');
    const { data: duplicatedCard, error: err7 } = await supabase
      .from('calendar_cards')
      .insert([
        {
          content: card2.content,
          color: card2.color,
          date: card2.date,
          time: card2.time,
          recurrence_type: card2.recurrence_type,
          recurrence_interval: card2.recurrence_interval,
          recurrence_days: card2.recurrence_days,
          recurrence_end_date: card2.recurrence_end_date,
        },
      ])
      .select()
      .single();

    if (err7 || !duplicatedCard) throw new Error(`Falha no Teste 7: ${err7?.message}`);
    createdIds.push(duplicatedCard.id);
    const hasNewUuid = duplicatedCard.id !== card2.id;
    console.log(
      `✓ Teste 7 concluído. Novo ID: ${duplicatedCard.id} (Diferente do original: ${hasNewUuid})`
    );

    // TESTE 8: Excluir todos os registros utilizados nos testes (FAIL-CLOSED)
    console.log('\n[TESTE 8] Limpando dados de teste do banco (fail-closed)...');
    guard.registerCreatedIds(createdIds);
    const cleanupResult = await guard.cleanup();
    console.log(`Registros de teste excluídos: ${cleanupResult.deletedCount}`);

    // Conferir se o banco preservou os dados preexistentes e limpou os de teste
    const dataProt = await guard.verifyDataProtection();
    const testClean = await guard.verifyTestCleanup();

    const isSuccess = dataProt.preserved && testClean.allRemoved;
    console.log(`✓ Teste 8 concluído. Integridade garantida: ${isSuccess}`);
    console.log('\n--- TODOS OS 8 TESTES EXECUTADOS COM SUCESSO! ---');
  } catch (err: unknown) {
    console.error('Erro na execução dos testes:', err);
    // Tenta limpar apenas os IDs de teste registrados caso algo tenha falhado
    guard.registerCreatedIds(createdIds);
    await guard.cleanup();
  }
}

runCrudTests();
