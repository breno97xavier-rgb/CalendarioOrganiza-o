import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Utilitário de Proteção e Isolamento de Dados para Scripts de Teste e Validação
 * 
 * Regras estritas:
 * 1. NUNCA apagar registros desconhecidos ou preexistentes.
 * 2. Limpeza SEMPRE FAIL-CLOSED: se a coleção de IDs for vazia, nula ou inválida, não executa DELETE.
 * 3. Identificação inequívoca: todo card criado em teste pode incluir marcador de execução.
 * 4. Validação de preservação: garante que 100% dos registros preexistentes continuam no banco.
 * 5. NUNCA exigir 'banco vazio' (calendar_cards = 0).
 */

export interface TestExecutionGuard {
  runId: string;
  preExistingIds: Set<string>;
  testCreatedIds: Set<string>;
  formatContent: (title: string) => string;
  registerCreatedId: (id: string) => string;
  registerCreatedIds: (ids: string[]) => string[];
  cleanup: () => Promise<{ deletedCount: number; errors: string[] }>;
  verifyDataProtection: () => Promise<{ preserved: boolean; missingIds: string[] }>;
  verifyTestCleanup: () => Promise<{ allRemoved: boolean; remainingIds: string[] }>;
}

export async function createTestGuard(
  rawClient: SupabaseClient,
  suiteName: string
): Promise<TestExecutionGuard> {
  const runId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const testCreatedIds = new Set<string>();

  // 1. Auditoria inicial (read-only): captura IDs preexistentes
  const { data: preExistingData, error: auditError } = await rawClient
    .from('calendar_cards')
    .select('id');

  if (auditError) {
    throw new Error(`[TestGuard - ${suiteName}] Falha ao auditar registros preexistentes: ${auditError.message}`);
  }

  const preExistingIds = new Set<string>((preExistingData || []).map((r) => r.id));
  console.log(`[TestGuard - ${suiteName}] Run ID: ${runId} | Registros preexistentes protegidos: ${preExistingIds.size}`);

  function formatContent(title: string): string {
    return `[TEST:${runId}] ${title}`;
  }

  function registerCreatedId(id: string): string {
    if (!id || typeof id !== 'string') {
      throw new Error(`[TestGuard - ${suiteName}] Tentativa de registrar ID de teste inválido: ${id}`);
    }
    testCreatedIds.add(id);
    return id;
  }

  function registerCreatedIds(ids: string[]): string[] {
    if (!Array.isArray(ids)) {
      throw new Error(`[TestGuard - ${suiteName}] Tentativa de registrar IDs inválidos (não é array)`);
    }
    for (const id of ids) {
      registerCreatedId(id);
    }
    return ids;
  }

  /**
   * Cleanup estritamente FAIL-CLOSED:
   * Apenas executa DELETE se testCreatedIds contiver IDs válidos e conhecidos criados por esta execução.
   * Se a lista for vazia, não faz NADA.
   */
  async function cleanup(): Promise<{ deletedCount: number; errors: string[] }> {
    const errors: string[] = [];
    const idsToDelete = Array.from(testCreatedIds).filter((id) => typeof id === 'string' && id.trim().length > 0);

    if (idsToDelete.length === 0) {
      console.log(`[TestGuard - ${suiteName}] Cleanup FAIL-CLOSED acionado: nenhum ID de teste registrado para remoção. Nenhuma exclusão executada.`);
      return { deletedCount: 0, errors: [] };
    }

    // Garante que NENHUM registro preexistente esteja na lista de exclusão
    const accidentalPreExisting = idsToDelete.filter((id) => preExistingIds.has(id));
    if (accidentalPreExisting.length > 0) {
      const msg = `[TestGuard CRITICAL] Bloqueada tentativa de excluir registros preexistentes: ${accidentalPreExisting.join(', ')}`;
      console.error(msg);
      throw new Error(msg);
    }

    try {
      // Exclui em lotes ou via .in('id', idsToDelete)
      const { error: delError } = await rawClient
        .from('calendar_cards')
        .delete()
        .in('id', idsToDelete);

      if (delError) {
        errors.push(delError.message);
        console.error(`[TestGuard - ${suiteName}] Erro ao deletar IDs de teste:`, delError.message);
      }
    } catch (e: unknown) {
      errors.push(String(e));
      console.error(`[TestGuard - ${suiteName}] Exceção no cleanup:`, e);
    }

    return { deletedCount: idsToDelete.length - errors.length, errors };
  }

  /**
   * Confirma que TODOS os registros preexistentes continuam no banco.
   */
  async function verifyDataProtection(): Promise<{ preserved: boolean; missingIds: string[] }> {
    if (preExistingIds.size === 0) {
      return { preserved: true, missingIds: [] };
    }

    const { data: currentData, error } = await rawClient
      .from('calendar_cards')
      .select('id')
      .in('id', Array.from(preExistingIds));

    if (error) {
      throw new Error(`[TestGuard - ${suiteName}] Erro ao verificar proteção de dados: ${error.message}`);
    }

    const currentIds = new Set((currentData || []).map((r) => r.id));
    const missingIds = Array.from(preExistingIds).filter((id) => !currentIds.has(id));

    return {
      preserved: missingIds.length === 0,
      missingIds,
    };
  }

  /**
   * Confirma que todos os registros criados pelo teste foram removidos.
   */
  async function verifyTestCleanup(): Promise<{ allRemoved: boolean; remainingIds: string[] }> {
    const idsToCheck = Array.from(testCreatedIds);
    if (idsToCheck.length === 0) {
      return { allRemoved: true, remainingIds: [] };
    }

    const { data: remainingData, error } = await rawClient
      .from('calendar_cards')
      .select('id')
      .in('id', idsToCheck);

    if (error) {
      throw new Error(`[TestGuard - ${suiteName}] Erro ao verificar remoção de testes: ${error.message}`);
    }

    const remainingIds = (remainingData || []).map((r) => r.id);
    return {
      allRemoved: remainingIds.length === 0,
      remainingIds,
    };
  }

  return {
    runId,
    preExistingIds,
    testCreatedIds,
    formatContent,
    registerCreatedId,
    registerCreatedIds,
    cleanup,
    verifyDataProtection,
    verifyTestCleanup,
  };
}
