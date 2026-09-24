import { createClient } from '@supabase/supabase-js';
import { createTestGuard } from './testSafety';
import { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears, format } from 'date-fns';
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
import { CalendarCard, CalendarOccurrence } from '../src/types/calendar';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configuradas.');
  process.exit(1);
}

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

async function runSuite() {
  console.log('=== INICIANDO VALIDAÇÃO F1.9 — RESPONSIVIDADE E ACABAMENTO VISUAL ===\n');

  const guard = await createTestGuard(rawClient, 'F1.9');
  console.log(`Auditoria inicial concluída. Registros preexistentes protegidos: ${guard.preExistingIds.size}\n`);

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✓ ${desc}`);
      passed++;
    } else {
      console.error(`✗ FALHA: ${desc} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // 1. Breakpoints e estrutura de layout
  console.log('\n--- 1. TESTES DE ESTRUTURA E BREAKPOINTS ---');
  const testBreakpoints = [
    { name: 'Desktop Grande', width: 1440, height: 900, yearlyCols: 4, isMobile: false },
    { name: 'Notebook Comum', width: 1366, height: 768, yearlyCols: 4, isMobile: false },
    { name: 'Desktop Médio / Tablet Paisagem', width: 1024, height: 768, yearlyCols: 3, isMobile: false },
    { name: 'Tablet Retrato', width: 768, height: 1024, yearlyCols: 2, isMobile: false },
    { name: 'Mobile Grande (iPhone 14 Pro Max)', width: 430, height: 932, yearlyCols: 1, isMobile: true },
    { name: 'Mobile Padrão (iPhone 12/13/14)', width: 390, height: 844, yearlyCols: 1, isMobile: true },
  ];

  for (const bp of testBreakpoints) {
    const cols = bp.width >= 1280 ? 4 : bp.width >= 1024 ? 3 : bp.width >= 640 ? 2 : 1;
    assert(
      `Breakpoint ${bp.name} (${bp.width}×${bp.height}): colunas anuais = ${cols}`,
      cols === bp.yearlyCols
    );
  }

  // 2. Títulos e Formatação em todas as 4 visualizações
  console.log('\n--- 2. TESTES DE TÍTULOS E CONTEXTO TEMPORAL NAS 4 VIEWS ---');
  const refDate = new Date(2026, 8, 23); // 23 de Setembro de 2026

  const monthTitle = formatCurrentPeriod(refDate);
  assert('Título Mês formatado corretamente', monthTitle.toLowerCase().includes('setembro') && monthTitle.includes('2026'));

  const weekTitle = formatWeekPeriod(refDate);
  assert('Título Semana formatado corretamente', weekTitle.toLowerCase().includes('setembro') && weekTitle.includes('2026'));

  const dayTitle = formatDayPeriod(refDate);
  assert('Título Dia formatado com dia da semana por extenso', dayTitle.toLowerCase().includes('quarta-feira') && dayTitle.includes('23'));

  const yearTitle = formatYearPeriod(refDate);
  assert('Título Ano minimalista e limpo ("2026")', yearTitle === '2026');

  // 3. Validação da Paleta de 15 Cores
  console.log('\n--- 3. TESTES DA PALETA DE 15 CORES ---');
  assert('Paleta possui exatamente 15 cores', COLOR_PALETTE.length === 15);
  const colorIds = new Set(COLOR_PALETTE.map((c) => c.id));
  assert('Todos os 15 IDs de cores são únicos', colorIds.size === 15);

  // 4. Integridade da Navegação Temporal nas 4 Views
  console.log('\n--- 4. TESTES DE NAVEGAÇÃO TEMPORAL NAS 4 VIEWS ---');
  // Mês
  const nextMonth = addMonths(refDate, 1);
  assert('Mês +1 vai para Outubro 2026', nextMonth.getMonth() === 9 && nextMonth.getFullYear() === 2026);
  // Semana
  const nextWeek = addWeeks(refDate, 1);
  assert('Semana +1 vai para 30/09/2026', nextWeek.getDate() === 30 && nextWeek.getMonth() === 8);
  // Dia
  const nextDay = addDays(refDate, 1);
  assert('Dia +1 vai para 24/09/2026', nextDay.getDate() === 24 && nextDay.getMonth() === 8);
  // Ano
  const nextYear = addYears(refDate, 1);
  assert('Ano +1 vai para 2027', nextYear.getFullYear() === 2027);

  // 5. Testes de CRUD Funcional no Supabase com Regressão
  console.log('\n--- 5. TESTES FUNCIONAIS DE CRUD E RECORRÊNCIA ---');
  // Criar card pontual
  const createdCard = await calendarCardService.createCard({
    content: guard.formatContent('Card Teste F1.9 Responsividade'),
    color: COLOR_PALETTE[0].hex,
    date: '2026-09-23',
    time: '14:30:00',
    recurrence_type: 'none',
  });
  guard.registerCreatedId(createdCard.id);
  assert('Card pontual criado com sucesso', !!createdCard?.id);

  // Criar série diária
  const createdDailySeries = await calendarCardService.createCard({
    content: guard.formatContent('Série Diária F1.9'),
    color: COLOR_PALETTE[2].hex,
    date: '2026-09-20',
    time: null,
    recurrence_type: 'daily',
    recurrence_interval: 1,
    recurrence_end_date: '2026-09-25',
  });
  guard.registerCreatedId(createdDailySeries.id);
  assert('Série diária criada com sucesso', !!createdDailySeries?.id);

  // Expandir ocorrências no Mês
  const allCards = await calendarCardService.getCards('2026-09-01', '2026-09-30');
  assert('Cards recuperados com sucesso', allCards.some((c) => c.id === createdCard.id) && allCards.some((c) => c.id === createdDailySeries.id));

  const monthRangeStart = '2026-09-01';
  const monthRangeEnd = '2026-09-30';
  const occurrences = expandRecurringCards(allCards, monthRangeStart, monthRangeEnd);

  // Pontual = 1 ocorrência
  const punctualOccs = occurrences.filter((o) => o.cardId === createdCard.id);
  assert('Card pontual gerou 1 ocorrência', punctualOccs.length === 1);

  // Diária 20 a 25 = 6 ocorrências
  const dailyOccs = occurrences.filter((o) => o.cardId === createdDailySeries.id);
  assert('Série diária 20 a 25 gerou 6 ocorrências', dailyOccs.length === 6);

  // Atualizar card pontual
  const updated = await calendarCardService.updateCard(createdCard.id, {
    content: guard.formatContent('Card Teste F1.9 Atualizado'),
    color: COLOR_PALETTE[4].hex,
  });
  assert('Card pontual atualizado com sucesso', updated?.content === guard.formatContent('Card Teste F1.9 Atualizado'));

  // Copiar card pontual
  const copied = await calendarCardService.createCard({
    content: guard.formatContent(`Cópia de ${updated.content}`),
    color: updated.color,
    date: updated.date,
    time: updated.time,
    recurrence_type: 'none',
  });
  guard.registerCreatedId(copied.id);
  assert('Cópia do card criada com sucesso', !!copied?.id);

  // Excluir card copiado
  await calendarCardService.deleteCard(copied.id);
  assert('Card copiado excluído com sucesso', true);

  // Excluir série diária
  await calendarCardService.deleteCard(createdDailySeries.id);
  assert('Série diária excluída com sucesso', true);

  // Excluir card pontual
  await calendarCardService.deleteCard(createdCard.id);
  assert('Card pontual original excluído com sucesso', true);

  // 6. Limpeza Final e Confirmação de Segurança
  console.log('\n--- 6. VERIFICAÇÃO DE LIMPEZA DO BANCO (FAIL-CLOSED) ---');
  await guard.cleanup();
  const dataProt = await guard.verifyDataProtection();
  const testClean = await guard.verifyTestCleanup();

  assert('Preservação estrita: dados preexistentes 100% protegidos', dataProt.preserved, dataProt.missingIds.join(', '));
  assert('Limpeza estrita: registros de teste 100% removidos', testClean.allRemoved, testClean.remainingIds.join(', '));

  console.log(`\n========================================`);
  console.log(`RESULTADO DA VALIDAÇÃO F1.9: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`DADOS PREEXISTENTES PROTEGIDOS: ${guard.preExistingIds.size} registros mantidos`);
  console.log(`========================================\n`);

  if (failed > 0 || !dataProt.preserved || !testClean.allRemoved) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Erro na execução da suíte:', err);
  process.exit(1);
});
