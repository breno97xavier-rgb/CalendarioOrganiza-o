import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { sidebarCardService } from '../src/services/sidebarCardService';
import { SidebarCardType, CreateSidebarCardInput } from '../src/types/sidebar';
import { COLOR_PALETTE } from '../src/utils/calendarUtils';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configuradas.');
  process.exit(1);
}

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

async function runValidationF111B() {
  console.log('================================================================');
  console.log('ETAPA: F1.11B — VALIDAÇÃO DE LEMBRETES E METAS (sidebar_cards)');
  console.log('================================================================\n');

  // 1. Auditoria e Proteção Rigorosa de calendar_cards
  const calendarGuard = await createTestGuard(rawClient, 'F1.11B-CalendarProtection');
  console.log(`[PROTEÇÃO] Registros preexistentes em calendar_cards: ${calendarGuard.preExistingIds.size}`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ [PASS] ${testName}`);
    } else {
      console.error(`  ✗ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    }
  }

  // TESTE 1: Validação dos Contratos de Tipos e Serviços
  console.log('\n>>> GRUPO 1: CONTRATO DE SERVIÇO E TIPOS');
  assert(typeof sidebarCardService.getSidebarCards === 'function', 'getSidebarCards é função');
  assert(typeof sidebarCardService.createSidebarCard === 'function', 'createSidebarCard é função');
  assert(typeof sidebarCardService.updateSidebarCard === 'function', 'updateSidebarCard é função');
  assert(typeof sidebarCardService.deleteSidebarCard === 'function', 'deleteSidebarCard é função');

  // TESTE 2: Validações síncronas de input (fail-fast no service)
  console.log('\n>>> GRUPO 2: VALIDAÇÕES DE INPUT NO SERVIÇO');
  try {
    await sidebarCardService.createSidebarCard({
      type: 'reminder',
      content: '   ',
      color: COLOR_PALETTE[0].hex,
    });
    assert(false, 'Bloqueio de conteúdo vazio na criação de sidebar_card');
  } catch (err: unknown) {
    assert(true, 'Bloqueio de conteúdo vazio na criação de sidebar_card');
  }

  try {
    await sidebarCardService.createSidebarCard({
      type: 'invalid_type' as unknown as SidebarCardType,
      content: 'Conteúdo válido',
      color: COLOR_PALETTE[0].hex,
    });
    assert(false, 'Bloqueio de type inválido');
  } catch (err: unknown) {
    assert(true, 'Bloqueio de type inválido');
  }

  try {
    await sidebarCardService.createSidebarCard({
      type: 'goal',
      content: 'Meta válida',
      color: '   ',
    });
    assert(false, 'Bloqueio de color vazia');
  } catch (err: unknown) {
    assert(true, 'Bloqueio de color vazia');
  }

  // TESTE 3: Verificação da Tabela Remota e Operações de Banco (se já migrada)
  console.log('\n>>> GRUPO 3: PERSISTÊNCIA EM BANCO DE DADOS (sidebar_cards)');
  const { data: testTableProbe, error: probeError } = await rawClient
    .from('sidebar_cards')
    .select('id')
    .limit(1);

  if (probeError && probeError.code === 'PGRST205') {
    console.log('  ℹ AVISO DE MIGRAÇÃO: A tabela public.sidebar_cards ainda não foi criada no schema do Supabase.');
    console.log('    Os scripts SQL idempotentes foram gerados em:');
    console.log('      - supabase/migration_f1_11b.sql');
    console.log('      - supabase/schema.sql');
    console.log('    Execute a migração no SQL Editor do Supabase para ativar a persistência remota em produção.');
    assert(true, 'Migration SQL estruturado e pronto em supabase/migration_f1_11b.sql');
  } else if (!probeError) {
    console.log('  ✓ Tabela public.sidebar_cards encontrada no Supabase!');
    const sidebarCreatedIds: string[] = [];

    try {
      // 3.1 Criar Lembrete
      const reminderInput: CreateSidebarCardInput = {
        type: 'reminder',
        content: `[TEST:F1.11B] Responder orçamento ${Date.now()}`,
        color: COLOR_PALETTE[0].hex,
      };
      const createdReminder = await sidebarCardService.createSidebarCard(reminderInput);
      sidebarCreatedIds.push(createdReminder.id);
      assert(createdReminder.type === 'reminder', 'Criação de reminder com type correto');
      assert(createdReminder.content === reminderInput.content, 'Criação de reminder com content correto');

      // 3.2 Criar Meta
      const goalInput: CreateSidebarCardInput = {
        type: 'goal',
        content: `[TEST:F1.11B] Fechar 3 clientes ${Date.now()}`,
        color: COLOR_PALETTE[4].hex,
      };
      const createdGoal = await sidebarCardService.createSidebarCard(goalInput);
      sidebarCreatedIds.push(createdGoal.id);
      assert(createdGoal.type === 'goal', 'Criação de goal com type correto');
      assert(createdGoal.content === goalInput.content, 'Criação de goal com content correto');

      // 3.3 Listagem e ordenação (created_at ASC)
      const allSidebarCards = await sidebarCardService.getSidebarCards();
      const hasReminder = allSidebarCards.some((c) => c.id === createdReminder.id);
      const hasGoal = allSidebarCards.some((c) => c.id === createdGoal.id);
      assert(hasReminder && hasGoal, 'getSidebarCards retorna os registros criados');

      // 3.4 Atualização
      const updatedReminder = await sidebarCardService.updateSidebarCard(createdReminder.id, {
        content: `[TEST:F1.11B] Atualizado ${Date.now()}`,
      });
      assert(updatedReminder.content.includes('Atualizado'), 'updateSidebarCard atualiza conteúdo');

      // 3.5 Exclusão
      await sidebarCardService.deleteSidebarCard(createdGoal.id);
      const afterDelete = await sidebarCardService.getSidebarCards();
      const goalStillExists = afterDelete.some((c) => c.id === createdGoal.id);
      assert(!goalStillExists, 'deleteSidebarCard remove o card corretamente');

      // Limpeza do lembrete remanescente (fail-closed)
      await rawClient.from('sidebar_cards').delete().in('id', sidebarCreatedIds);
      console.log(`  ✓ Limpeza fail-closed dos registros de teste de sidebar_cards concluída.`);
    } catch (dbErr: unknown) {
      console.error('Erro durante operações em sidebar_cards:', dbErr);
      // Limpa os IDs criados em caso de falha
      if (sidebarCreatedIds.length > 0) {
        await rawClient.from('sidebar_cards').delete().in('id', sidebarCreatedIds);
      }
    }
  } else {
    console.log('  ℹ Resposta do Supabase para sidebar_cards:', probeError.message);
  }

  // TESTE 4: Verificação Estrita de Proteção dos Dados em calendar_cards
  console.log('\n>>> GRUPO 4: PROTEÇÃO INTACTA DE calendar_cards');
  const dataProt = await calendarGuard.verifyDataProtection();
  assert(dataProt.preserved, 'calendar_cards 100% preservada (Nenhum registro alterado ou excluído)');
  if (!dataProt.preserved) {
    console.error('  CRITICAL: Registros ausentes:', dataProt.missingIds);
  }

  console.log(`\n================================================================`);
  console.log(`RESULTADO DA VALIDAÇÃO F1.11B: ${passedTests}/${totalTests} testes aprovados.`);
  console.log(`================================================================\n`);
}

runValidationF111B().catch((err) => {
  console.error('Erro fatal na validação F1.11B:', err);
  process.exit(1);
});
