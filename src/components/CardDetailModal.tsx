import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Edit2, Copy, Trash2, AlertCircle, Repeat } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCard, CalendarOccurrence } from '../types/calendar';
import { getRecurrenceSummary } from '../utils/recurrenceUtils';

interface CardDetailModalProps {
  occurrence: CalendarOccurrence | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (card: CalendarCard) => void;
  onCopy: (card: CalendarCard) => void;
  onDelete: (cardId: string) => Promise<void>;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  occurrence,
  isOpen,
  onClose,
  onEdit,
  onCopy,
  onDelete,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset do estado ao abrir
  useEffect(() => {
    if (isOpen) {
      setIsConfirmingDelete(false);
      setIsDeleting(false);
      setDeleteError(null);
    }
  }, [isOpen, occurrence?.occurrenceKey]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !occurrence) return null;

  const card = occurrence.card;

  // Formatação segura de datas
  const formatDateString = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formattedOccurrenceDate = formatDateString(occurrence.occurrenceDate);
  const formattedBaseDate = formatDateString(card.date);
  const formattedEndDate = card.recurrence_end_date
    ? formatDateString(card.recurrence_end_date)
    : null;

  const formattedTime = card.time ? card.time.slice(0, 5) : null;
  const recurrenceSummary = getRecurrenceSummary(card);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(card.id);
      onClose();
    } catch (err: unknown) {
      console.error('Erro ao excluir card/série:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível excluir o card.';
      setDeleteError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-auto">
        {/* Faixa superior com a cor do card */}
        <div className="h-2 w-full shrink-0" style={{ backgroundColor: card.color }} />

        {/* Cabeçalho */}
        <div className="px-4 sm:px-5 pt-3.5 pb-2.5 flex items-center justify-between shrink-0 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full ring-1 ring-neutral-300 shadow-2xs shrink-0"
              style={{ backgroundColor: card.color }}
            />
            <span id="card-detail-title" className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {occurrence.isRecurring ? 'Detalhes da ocorrência (série)' : 'Detalhes do card'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo Principal Rolável */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Mensagem de Erro */}
          {deleteError && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{deleteError}</span>
            </div>
          )}

          {/* Texto integral com respeito às quebras de linha */}
          <div className="text-sm text-neutral-800 whitespace-pre-wrap break-words leading-relaxed font-normal bg-neutral-50/70 p-3.5 rounded-lg border border-neutral-200/70 max-h-60 overflow-y-auto custom-scrollbar">
            {card.content}
          </div>

          {/* Metadados: Data da Ocorrência, Horário e Recorrência */}
          <div className="space-y-2 text-xs text-neutral-600 pt-1 border-t border-neutral-100">
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-500">Data desta ocorrência:</span>
                <span className="font-semibold text-neutral-800">{formattedOccurrenceDate}</span>
              </div>

              {formattedTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="font-medium text-neutral-700">{formattedTime}</span>
                </div>
              )}
            </div>

            {/* Informações detalhadas de série recorrente */}
            {occurrence.isRecurring && (
              <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/70 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <Repeat className="w-3.5 h-3.5 text-neutral-600" />
                  <span>{recurrenceSummary}</span>
                </div>
                <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3">
                  <span>Início da série: <strong className="text-neutral-700 font-medium">{formattedBaseDate}</strong></span>
                  {formattedEndDate && (
                    <span>Repetir até: <strong className="text-neutral-700 font-medium">{formattedEndDate}</strong></span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Fixo com Barra de Ações ou Confirmação de Exclusão */}
        <div className="shrink-0 border-t border-neutral-100 bg-neutral-50/60 p-3 sm:p-4">
          {isConfirmingDelete ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-red-900 leading-snug">
                {occurrence.isRecurring
                  ? 'Tem certeza que deseja excluir toda a série? Esta ação removerá o registro-base e todas as ocorrências deste card.'
                  : 'Tem certeza que deseja excluir este card? Esta ação não pode ser desfeita.'}
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 min-h-[36px] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 rounded-md transition-colors cursor-pointer text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 min-h-[36px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md shadow-2xs transition-colors cursor-pointer text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  {isDeleting
                    ? 'Excluindo...'
                    : occurrence.isRecurring
                    ? 'Confirmar Exclusão da Série'
                    : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="px-3 py-1.5 min-h-[36px] text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{occurrence.isRecurring ? 'Excluir série' : 'Excluir'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCopy(card)}
                  className="px-3 py-1.5 min-h-[36px] text-xs font-medium text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{occurrence.isRecurring ? 'Copiar série' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(card)}
                  className="px-3.5 py-1.5 min-h-[36px] text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{occurrence.isRecurring ? 'Editar série' : 'Editar'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
