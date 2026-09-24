import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { COLOR_PALETTE } from '../utils/calendarUtils';
import { SidebarCardType } from '../types/sidebar';

export type SidebarCardModalMode = 'CREATE' | 'EDIT';

interface SidebarCardModalProps {
  isOpen: boolean;
  mode: SidebarCardModalMode;
  type: SidebarCardType;
  initialContent?: string;
  initialColor?: string;
  onClose: () => void;
  onSave: (content: string, color: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export const SidebarCardModal: React.FC<SidebarCardModalProps> = ({
  isOpen,
  mode,
  type,
  initialContent = '',
  initialColor = COLOR_PALETTE[0].hex,
  onClose,
  onSave,
  onDelete,
}) => {
  const [content, setContent] = useState(initialContent);
  const [color, setColor] = useState(initialColor);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isReminder = type === 'reminder';
  const itemLabel = isReminder ? 'lembrete' : 'meta';
  const itemLabelCapitalized = isReminder ? 'Lembrete' : 'Meta';

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent || '');
      setColor(initialColor || COLOR_PALETTE[0].hex);
      setIsConfirmingDelete(false);
      setIsSubmitting(false);
      setErrorMessage(null);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen, mode, type, initialContent, initialColor]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isConfirmingDelete, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setErrorMessage(`O conteúdo d${isReminder ? 'o' : 'a'} ${itemLabel} não pode estar vazio.`);
      textareaRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSave(trimmedContent, color);
      onClose();
    } catch (err: unknown) {
      console.error(`Erro ao salvar ${itemLabel}:`, err);
      const msg =
        err instanceof Error
          ? err.message
          : `Não foi possível salvar ${itemLabel}. Tente novamente.`;
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onDelete();
      onClose();
    } catch (err: unknown) {
      console.error(`Erro ao excluir ${itemLabel}:`, err);
      const msg =
        err instanceof Error
          ? err.message
          : `Não foi possível excluir ${itemLabel}. Tente novamente.`;
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  const modalTitle =
    mode === 'CREATE'
      ? `Nov${isReminder ? 'o' : 'a'} ${itemLabelCapitalized}`
      : `Editar ${itemLabelCapitalized}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sidebar-card-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-auto">
        {/* Faixa superior com a cor selecionada */}
        <div className="h-2 w-full shrink-0 transition-colors duration-200" style={{ backgroundColor: color }} />

        {/* Cabeçalho */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full ring-1 ring-neutral-300 shadow-2xs shrink-0 transition-colors duration-200"
              style={{ backgroundColor: color }}
            />
            <h2
              id="sidebar-card-modal-title"
              className="text-sm font-semibold text-neutral-900"
            >
              {modalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Conteúdo */}
            <div>
              <label
                htmlFor="sidebar-card-content"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Conteúdo
              </label>
              <textarea
                id="sidebar-card-content"
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                placeholder={
                  isReminder
                    ? 'Ex: Responder orçamento, Comprar café, Pesquisar equipamento...'
                    : 'Ex: Fechar 3 clientes este mês, Publicar 4 vídeos, Estudar 5 blocos...'
                }
                className="w-full px-3 py-2 text-sm text-neutral-900 border border-neutral-200 rounded-md shadow-2xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 resize-none transition-all placeholder:text-neutral-400"
              />
            </div>

            {/* Seleção de Cor */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Cor
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                {COLOR_PALETTE.map((option) => {
                  const isSelected = color.toLowerCase() === option.hex.toLowerCase();
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setColor(option.hex)}
                      disabled={isSubmitting}
                      className={`aspect-square rounded-md transition-all cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                        isSelected
                          ? 'ring-2 ring-neutral-900 ring-offset-2 scale-105'
                          : 'hover:scale-110 opacity-90 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: option.hex }}
                      aria-label={`Cor ${option.hex}`}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rodapé com Ações ou Confirmação de Exclusão */}
          <div className="px-4 sm:px-5 py-3 border-t border-neutral-100 bg-neutral-50/60 shrink-0">
            {isConfirmingDelete ? (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-red-900 leading-snug">
                  Tem certeza que deseja excluir est{isReminder ? 'e lembrete' : 'a meta'}? Esta ação não pode ser desfeita.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 min-h-[36px] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 min-h-[36px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md shadow-2xs transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    {isSubmitting ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {mode === 'EDIT' && onDelete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={isSubmitting}
                    className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 min-h-[36px] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 min-h-[36px] text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                  >
                    {isSubmitting
                      ? 'Salvando...'
                      : mode === 'EDIT'
                      ? 'Salvar alterações'
                      : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
