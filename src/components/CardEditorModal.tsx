import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';
import { COLOR_PALETTE } from '../utils/calendarUtils';
import { RecurrenceType, RecurrenceUnit } from '../types/calendar';

export type CardEditorMode = 'CREATE' | 'EDIT' | 'COPY';

export interface CardEditorFormData {
  content: string;
  color: string;
  date: string;
  time: string | null;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_unit: RecurrenceUnit | null;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
}

interface CardEditorModalProps {
  isOpen: boolean;
  mode: CardEditorMode;
  initialDate: string; // YYYY-MM-DD
  initialColor: string; // Hex
  initialContent?: string;
  initialTime?: string | null;
  initialRecurrenceType?: RecurrenceType;
  initialRecurrenceInterval?: number;
  initialRecurrenceUnit?: RecurrenceUnit | null;
  initialRecurrenceDays?: number[] | null;
  initialRecurrenceEndDate?: string | null;
  onClose: () => void;
  onSave: (data: CardEditorFormData) => Promise<void>;
}

const WEEK_DAY_BUTTONS = [
  { id: 1, label: 'SEG' },
  { id: 2, label: 'TER' },
  { id: 3, label: 'QUA' },
  { id: 4, label: 'QUI' },
  { id: 5, label: 'SEX' },
  { id: 6, label: 'SÁB' },
  { id: 7, label: 'DOM' },
];

function getIsoDayFromDate(dateStr: string): number {
  if (!dateStr) return 1;
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  isOpen,
  mode,
  initialDate,
  initialColor,
  initialContent = '',
  initialTime = null,
  initialRecurrenceType = 'none',
  initialRecurrenceInterval = 1,
  initialRecurrenceUnit = null,
  initialRecurrenceDays = null,
  initialRecurrenceEndDate = null,
  onClose,
  onSave,
}) => {
  const [content, setContent] = useState(initialContent);
  const [color, setColor] = useState(initialColor);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime ? initialTime.slice(0, 5) : '');

  // Recorrência
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(initialRecurrenceType);
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(initialRecurrenceInterval);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit | null>(initialRecurrenceUnit);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(initialRecurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(initialRecurrenceEndDate || '');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inicializa o estado quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent || '');
      setColor(initialColor);
      setDate(initialDate);
      setTime(initialTime ? initialTime.slice(0, 5) : '');
      setRecurrenceType(initialRecurrenceType || 'none');
      setRecurrenceInterval(initialRecurrenceInterval || 1);
      setRecurrenceUnit(initialRecurrenceUnit || null);
      setRecurrenceDays(
        initialRecurrenceDays && initialRecurrenceDays.length > 0
          ? initialRecurrenceDays
          : [getIsoDayFromDate(initialDate)]
      );
      setRecurrenceEndDate(initialRecurrenceEndDate || '');
      setErrorMessage(null);
      setIsSubmitting(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [
    isOpen,
    mode,
    initialDate,
    initialColor,
    initialContent,
    initialTime,
    initialRecurrenceType,
    initialRecurrenceInterval,
    initialRecurrenceUnit,
    initialRecurrenceDays,
    initialRecurrenceEndDate,
  ]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  // Mudança de tipo de recorrência com limpeza de campos inaplicáveis
  const handleRecurrenceTypeChange = (newType: RecurrenceType) => {
    setRecurrenceType(newType);
    const dayOfWeek = getIsoDayFromDate(date);

    if (newType === 'none') {
      setRecurrenceInterval(1);
      setRecurrenceUnit(null);
      setRecurrenceDays([]);
      setRecurrenceEndDate('');
    } else if (newType === 'daily') {
      setRecurrenceInterval(1);
      setRecurrenceUnit(null);
      setRecurrenceDays([]);
    } else if (newType === 'weekly') {
      setRecurrenceInterval(1);
      setRecurrenceUnit(null);
      setRecurrenceDays([dayOfWeek]);
    } else if (newType === 'monthly') {
      setRecurrenceInterval(1);
      setRecurrenceUnit(null);
      setRecurrenceDays([]);
    } else if (newType === 'custom') {
      if (!recurrenceUnit) {
        setRecurrenceUnit('week');
      }
      if (recurrenceDays.length === 0) {
        setRecurrenceDays([dayOfWeek]);
      }
    }
  };

  // Alterna a seleção de um dia da semana para recorrência customizada
  const toggleRecurrenceDay = (dayId: number) => {
    setRecurrenceDays((prev) => {
      if (prev.includes(dayId)) {
        // Mantém pelo menos 1 dia selecionado se possível
        const next = prev.filter((d) => d !== dayId);
        return next;
      } else {
        return [...prev, dayId].sort();
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setErrorMessage('O conteúdo do card não pode estar vazio.');
      textareaRef.current?.focus();
      return;
    }

    if (!date) {
      setErrorMessage('Por favor, informe uma data válida.');
      return;
    }

    // Validações de recorrência
    if (recurrenceType !== 'none') {
      if (!recurrenceInterval || recurrenceInterval < 1) {
        setErrorMessage('O intervalo de repetição deve ser de no mínimo 1.');
        return;
      }

      if (recurrenceEndDate && recurrenceEndDate < date) {
        setErrorMessage('A data final da repetição deve ser igual ou posterior à data de início.');
        return;
      }

      if (recurrenceType === 'custom') {
        if (!recurrenceUnit || !['day', 'week', 'month'].includes(recurrenceUnit)) {
          setErrorMessage('Para repetição personalizada, selecione a unidade (dia, semana ou mês).');
          return;
        }

        if (recurrenceUnit === 'week' && recurrenceDays.length === 0) {
          setErrorMessage('Selecione pelo menos um dia da semana para a repetição.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Normalização estrita para envio
    let finalInterval = 1;
    let finalUnit: RecurrenceUnit | null = null;
    let finalDays: number[] | null = null;
    let finalEndDate: string | null = recurrenceEndDate ? recurrenceEndDate : null;

    if (recurrenceType === 'none') {
      finalInterval = 1;
      finalUnit = null;
      finalDays = null;
      finalEndDate = null;
    } else if (recurrenceType === 'daily') {
      finalInterval = 1;
      finalUnit = null;
      finalDays = null;
    } else if (recurrenceType === 'weekly') {
      finalInterval = 1;
      finalUnit = null;
      finalDays = recurrenceDays.length > 0 ? recurrenceDays : [getIsoDayFromDate(date)];
    } else if (recurrenceType === 'monthly') {
      finalInterval = 1;
      finalUnit = null;
      finalDays = null;
    } else if (recurrenceType === 'custom') {
      finalInterval = Math.max(1, recurrenceInterval);
      finalUnit = recurrenceUnit;
      finalDays = recurrenceUnit === 'week' ? recurrenceDays : null;
    }

    try {
      await onSave({
        content: trimmedContent,
        color,
        date,
        time: time ? time : null,
        recurrence_type: recurrenceType,
        recurrence_interval: finalInterval,
        recurrence_unit: finalUnit,
        recurrence_days: finalDays,
        recurrence_end_date: finalEndDate,
      });
      onClose();
    } catch (err: unknown) {
      console.error(`Erro ao salvar card (modo ${mode}):`, err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar as alterações. Tente novamente.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'EDIT':
        return recurrenceType !== 'none' ? 'Editar série recorrente' : 'Editar card';
      case 'COPY':
        return recurrenceType !== 'none' ? 'Copiar série' : 'Copiar card';
      case 'CREATE':
      default:
        return 'Novo card';
    }
  };

  const getSubmitButtonLabel = () => {
    if (isSubmitting) {
      switch (mode) {
        case 'EDIT':
          return 'Salvando alterações...';
        case 'COPY':
          return 'Criando cópia...';
        case 'CREATE':
        default:
          return 'Salvando...';
      }
    }

    switch (mode) {
      case 'EDIT':
        return 'Salvar alterações';
      case 'COPY':
        return 'Criar cópia';
      case 'CREATE':
      default:
        return 'Salvar';
    }
  };

  const isEditingRecurring = mode === 'EDIT' && initialRecurrenceType !== 'none';

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
      aria-labelledby="card-editor-title"
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-auto">
        {/* Cabeçalho do Modal */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full ring-1 ring-neutral-300 shadow-2xs"
              style={{ backgroundColor: color }}
            />
            <h2 id="card-editor-title" className="text-sm font-semibold text-neutral-900">
              {getTitle()}
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

        {/* Formulário com corpo rolável e rodapé fixo */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {/* Aviso contextual de edição em série */}
            {isEditingRecurring && (
              <div className="p-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Esta alteração será aplicada a toda a série.</span>
              </div>
            )}

            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Área de Texto */}
            <div>
              <label
                htmlFor="card-content"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Conteúdo
              </label>
              <textarea
                id="card-content"
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                placeholder="Escreva livremente aqui..."
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

          {/* Campos de Data e Horário */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor="card-date"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                {recurrenceType !== 'none' ? 'Data de início' : 'Data'}
              </label>
              <input
                id="card-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  // Atualiza dia padrão da semana se for semanal
                  if (recurrenceType === 'weekly') {
                    setRecurrenceDays([getIsoDayFromDate(e.target.value)]);
                  }
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs text-neutral-900 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition-all bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="card-time"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Horário <span className="text-neutral-400 font-normal">(opcional)</span>
              </label>
              <input
                id="card-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs text-neutral-900 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition-all bg-white"
              />
            </div>
          </div>

          {/* Seção REPETIR (Recorrência) */}
          <div className="pt-2 border-t border-neutral-100 space-y-3">
            <div>
              <label
                htmlFor="card-recurrence"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Repetir
              </label>
              <select
                id="card-recurrence"
                value={recurrenceType}
                onChange={(e) => handleRecurrenceTypeChange(e.target.value as RecurrenceType)}
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs text-neutral-900 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition-all bg-white cursor-pointer"
              >
                <option value="none">Não repetir</option>
                <option value="daily">Todos os dias</option>
                <option value="weekly">Toda semana</option>
                <option value="monthly">Todo mês</option>
                <option value="custom">Personalizar</option>
              </select>
            </div>

            {/* Opções adicionais quando a recorrência é ativada */}
            {recurrenceType !== 'none' && (
              <div className="space-y-3 bg-neutral-50/70 p-3 rounded-md border border-neutral-200/60 text-xs">
                {/* Se for Personalizar */}
                {recurrenceType === 'custom' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="recurrence-interval"
                          className="block text-[11px] font-medium text-neutral-600 mb-1"
                        >
                          Repetir a cada
                        </label>
                        <input
                          id="recurrence-interval"
                          type="number"
                          min={1}
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          disabled={isSubmitting}
                          className="w-full px-2.5 py-1 text-xs text-neutral-900 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="recurrence-unit"
                          className="block text-[11px] font-medium text-neutral-600 mb-1"
                        >
                          Unidade
                        </label>
                        <select
                          id="recurrence-unit"
                          value={recurrenceUnit || 'week'}
                          onChange={(e) => setRecurrenceUnit(e.target.value as RecurrenceUnit)}
                          disabled={isSubmitting}
                          className="w-full px-2.5 py-1 text-xs text-neutral-900 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white cursor-pointer"
                        >
                          <option value="day">dia(s)</option>
                          <option value="week">semana(s)</option>
                          <option value="month">mês(es)</option>
                        </select>
                      </div>
                    </div>

                    {/* Seleção de dias da semana para custom + week */}
                    {recurrenceUnit === 'week' && (
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                          Dias da semana
                        </label>
                        <div className="grid grid-cols-7 gap-1">
                          {WEEK_DAY_BUTTONS.map((day) => {
                            const isSelected = recurrenceDays.includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => toggleRecurrenceDay(day.id)}
                                disabled={isSubmitting}
                                className={`py-1 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Data de término opcional ("Repetir até") */}
                <div>
                  <label
                    htmlFor="recurrence-end-date"
                    className="block text-[11px] font-medium text-neutral-600 mb-1"
                  >
                    Repetir até <span className="text-neutral-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    id="recurrence-end-date"
                    type="date"
                    min={date}
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-2.5 py-1 text-xs text-neutral-900 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação fixos no rodapé do modal */}
        <div className="px-4 sm:px-5 py-3 border-t border-neutral-100 bg-neutral-50/60 flex items-center justify-end gap-2 shrink-0">
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
              {getSubmitButtonLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
