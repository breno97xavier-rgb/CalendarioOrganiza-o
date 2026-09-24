import React from 'react';
import { ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react';
import { CalendarView } from '../types/calendar';
import { formatCurrentPeriod, formatWeekPeriod, formatDayPeriod, formatYearPeriod } from '../utils/calendarUtils';

interface CalendarHeaderProps {
  currentDate: Date;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  selectedView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  isLoading?: boolean;
  onOpenSidebar?: () => void;
}

const VIEW_OPTIONS: { id: CalendarView; label: string; disabled?: boolean }[] = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
];

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  selectedView,
  onViewChange,
  isLoading = false,
  onOpenSidebar,
}) => {
  const periodTitle =
    selectedView === 'year'
      ? formatYearPeriod(currentDate)
      : selectedView === 'day'
      ? formatDayPeriod(currentDate)
      : selectedView === 'week'
      ? formatWeekPeriod(currentDate)
      : formatCurrentPeriod(currentDate);

  return (
    <header className="px-4 sm:px-6 py-2.5 sm:py-0 sm:h-16 border-b border-neutral-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 shrink-0 select-none">
      {/* Bloco de Navegação e Período */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={onPreviousPeriod}
              className="p-1.5 sm:p-1.5 rounded-md min-w-[36px] min-h-[36px] flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
              aria-label="Período anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              className="p-1.5 sm:p-1.5 rounded-md min-w-[36px] min-h-[36px] flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
              aria-label="Próximo período"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToday}
            className="px-2.5 sm:px-3 py-1.5 min-h-[36px] flex items-center text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/90 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 shrink-0 cursor-pointer"
          >
            Hoje
          </button>
        </div>

        {/* Título do período com redimensionamento fluido */}
        <div className="flex items-center gap-2 min-w-0 pl-1 sm:pl-2">
          <h1 className="text-sm sm:text-base lg:text-xl font-medium tracking-tight text-neutral-900 leading-snug break-words">
            {periodTitle}
          </h1>
          {isLoading && (
            <span
              className="w-2 h-2 rounded-full bg-neutral-400 animate-pulse shrink-0"
              title="Atualizando cards..."
            />
          )}
        </div>
      </div>

      {/* Seletor de Visualização e Acesso Móvel à Lateral */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 min-h-[32px] sm:min-h-[28px] text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/90 rounded-md border border-neutral-200/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer shrink-0"
            aria-label="Abrir lembretes e metas"
            title="Lembretes e metas"
          >
            <CheckSquare className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-xs">Lembretes & Metas</span>
          </button>
        )}

        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/80 w-auto justify-between sm:justify-start">
          {VIEW_OPTIONS.map((view) => {
            const isActive = selectedView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                disabled={view.disabled}
                onClick={() => {
                  if (!view.disabled) {
                    onViewChange(view.id);
                  }
                }}
                title={view.disabled ? 'Em breve' : undefined}
                className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 min-h-[32px] sm:min-h-[28px] text-xs font-medium rounded-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  isActive
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : view.disabled
                    ? 'text-neutral-300 cursor-not-allowed'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

