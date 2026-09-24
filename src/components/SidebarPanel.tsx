import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { SidebarCard, SidebarCardType } from '../types/sidebar';
import { sidebarCardService } from '../services/sidebarCardService';
import { SidebarCardItem } from './SidebarCardItem';
import { SidebarCardModal, SidebarCardModalMode } from './SidebarCardModal';

interface SidebarPanelProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  isMobileOpen,
  onCloseMobile,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Estado dos cards
  const [cards, setCards] = useState<SidebarCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado do modal de criação/edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<SidebarCardModalMode>('CREATE');
  const [modalType, setModalType] = useState<SidebarCardType>('reminder');
  const [editingCard, setEditingCard] = useState<SidebarCard | null>(null);

  // Busca os cards do Supabase
  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await sidebarCardService.getSidebarCards();
      setCards(data);
      setErrorMessage(null);
    } catch (err: unknown) {
      console.warn('Não foi possível carregar sidebar_cards do Supabase:', err);
      // Se a tabela ainda estiver pendente de criação, não quebra a interface
      setErrorMessage('Lembretes e metas indisponíveis no momento.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Separação dos cards por tipo
  const reminders = useMemo(() => {
    return cards.filter((c) => c.type === 'reminder');
  }, [cards]);

  const goals = useMemo(() => {
    return cards.filter((c) => c.type === 'goal');
  }, [cards]);

  // Abrir modal de criação para tipo específico
  const handleOpenCreate = (type: SidebarCardType) => {
    setEditingCard(null);
    setModalType(type);
    setModalMode('CREATE');
    setIsModalOpen(true);
  };

  // Abrir modal de edição para card existente
  const handleCardClick = (card: SidebarCard) => {
    setEditingCard(card);
    setModalType(card.type);
    setModalMode('EDIT');
    setIsModalOpen(true);
  };

  // Salvar (criação ou edição)
  const handleSaveModal = async (content: string, color: string) => {
    if (modalMode === 'EDIT' && editingCard) {
      await sidebarCardService.updateSidebarCard(editingCard.id, {
        content,
        color,
      });
    } else {
      await sidebarCardService.createSidebarCard({
        type: modalType,
        content,
        color,
      });
    }
    await fetchCards();
  };

  // Excluir card da lateral
  const handleDeleteModal = async () => {
    if (!editingCard) return;
    await sidebarCardService.deleteSidebarCard(editingCard.id);
    await fetchCards();
  };

  // Fecha no Escape quando o drawer mobile está aberto
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseMobile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timeout = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  // Conteúdo das seções Lembretes e Metas
  const renderSections = () => (
    <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto custom-scrollbar">
      {errorMessage && (
        <div className="p-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={fetchCards}
            className="text-[11px] underline hover:text-amber-950 font-medium shrink-0 cursor-pointer"
          >
            Tentar
          </button>
        </div>
      )}

      {/* Seção Lembretes */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              Lembretes
            </h2>
            {reminders.length > 0 && (
              <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">
                {reminders.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreate('reminder')}
            aria-label="Adicionar lembrete"
            title="Adicionar novo lembrete"
            className="w-6 h-6 rounded flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {reminders.length === 0 ? (
          <div className="py-7 px-3 flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70">
            <p className="text-xs text-neutral-400 font-normal select-none">
              Nenhum lembrete
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reminders.map((card) => (
              <SidebarCardItem
                key={card.id}
                card={card}
                onClick={handleCardClick}
              />
            ))}
          </div>
        )}
      </section>

      {/* Seção Metas */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              Metas
            </h2>
            {goals.length > 0 && (
              <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">
                {goals.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreate('goal')}
            aria-label="Adicionar meta"
            title="Adicionar nova meta"
            className="w-6 h-6 rounded flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="py-7 px-3 flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70">
            <p className="text-xs text-neutral-400 font-normal select-none">
              Nenhuma meta
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {goals.map((card) => (
              <SidebarCardItem
                key={card.id}
                card={card}
                onClick={handleCardClick}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );

  return (
    <>
      {/* 1. Painel Desktop (Permanente à direita em telas md e superiores) */}
      <aside
        className="hidden md:flex flex-col border-l border-neutral-200 bg-white md:w-64 lg:w-72 shrink-0 select-none overflow-hidden"
        aria-label="Painel lateral de lembretes e metas"
      >
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-800 tracking-tight">
            Lembretes e Metas
          </span>
          {isLoading && (
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
          )}
        </div>
        {renderSections()}
      </aside>

      {/* 2. Drawer Mobile / Tablet (Apenas quando aberto em telas < md) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex justify-end bg-neutral-900/40 backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Painel de lembretes e metas"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs h-full bg-white shadow-2xl flex flex-col border-l border-neutral-200"
          >
            {/* Cabeçalho do Drawer */}
            <div className="px-4 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900 tracking-tight">
                  Lembretes e Metas
                </span>
                {isLoading && (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
                )}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
                aria-label="Fechar painel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com scroll seguro */}
            {renderSections()}
          </div>
        </div>
      )}

      {/* Modal Unificado de Lembrete / Meta (CREATE e EDIT) */}
      <SidebarCardModal
        isOpen={isModalOpen}
        mode={modalMode}
        type={modalType}
        initialContent={editingCard?.content}
        initialColor={editingCard?.color}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveModal}
        onDelete={modalMode === 'EDIT' ? handleDeleteModal : undefined}
      />
    </>
  );
};
