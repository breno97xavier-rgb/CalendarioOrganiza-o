import React from 'react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Repeat, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { CalendarOccurrence } from '../types/calendar';
import { sortOccurrencesForDay } from '../utils/recurrenceUtils';
import { getContrastTextColor } from '../utils/calendarUtils';

interface DailyCalendarProps {
  currentDate: Date;
  occurrences: CalendarOccurrence[];
  onDayClick: (dateString: string) => void;
  onOccurrenceClick: (occurrence: CalendarOccurrence) => void;
}

export const DailyCalendar: React.FC<DailyCalendarProps> = ({
  currentDate,
  occurrences,
  onDayClick,
  onOccurrenceClick,
}) => {
  const dateString = format(currentDate, 'yyyy-MM-dd');
  const dayOfWeek = format(currentDate, 'EEEE', { locale: ptBR }).toUpperCase();
  const dayNumber = currentDate.getDate();
  const monthYear = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  const isDateToday = isToday(currentDate);

  // Ordenação padronizada: com horário (cronológico) -> sem horário (created_at)
  const sortedOccurrences = sortOccurrencesForDay(occurrences);
  const timedOccurrences = sortedOccurrences.filter((occ) => !!occ.time);
  const untimedOccurrences = sortedOccurrences.filter((occ) => !occ.time);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-8 custom-scrollbar">
        <div className="max-w-2xl mx-auto w-full space-y-6 sm:space-y-8">
          {/* Cabeçalho do Dia */}
          <div className="border-b border-neutral-200 pb-4 sm:pb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                {dayOfWeek}
              </span>
              {isDateToday && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-900 text-white rounded-full">
                  Hoje
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2.5 sm:gap-3">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
                {dayNumber}
              </span>
              <span className="text-sm sm:text-base text-neutral-500 font-medium capitalize">
                {monthYear}
              </span>
            </div>
          </div>

          {/* Estado Vazio: Nenhum card no dia */}
          {sortedOccurrences.length === 0 ? (
            <div className="py-14 border border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center text-center px-4 bg-neutral-50/50">
              <p className="text-sm font-medium text-neutral-500 mb-4">
                Nenhum card neste dia.
              </p>
              <button
                type="button"
                onClick={() => onDayClick(dateString)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg shadow-2xs transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar card
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Seção 1: Cards Com Horário */}
              {timedOccurrences.length > 0 && (
                <section aria-labelledby="timed-section-heading" className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <Clock className="w-3.5 h-3.5" />
                    <h2
                      id="timed-section-heading"
                      className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Com horário
                    </h2>
                    <span className="text-xs text-neutral-400 font-normal">
                      ({timedOccurrences.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {timedOccurrences.map((occurrence) => {
                      const textColor = getContrastTextColor(occurrence.color);
                      const formattedTime = occurrence.time ? occurrence.time.slice(0, 5) : '';

                      return (
                        <div
                          key={occurrence.occurrenceKey}
                          onClick={() => onOccurrenceClick(occurrence)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOccurrenceClick(occurrence);
                            }
                          }}
                          className="rounded-lg p-3.5 shadow-2xs cursor-pointer transition-all hover:opacity-95 hover:shadow-xs active:scale-[0.99] flex flex-col gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                          style={{
                            backgroundColor: occurrence.color,
                            color: textColor,
                          }}
                          title={occurrence.content}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-black/10 tabular-nums">
                              {formattedTime}
                            </span>
                            {occurrence.isRecurring && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] opacity-80"
                                title="Item recorrente"
                              >
                                <Repeat className="w-3 h-3" />
                                <span className="font-normal text-[10px]">Série</span>
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-medium leading-relaxed whitespace-pre-line break-words line-clamp-6">
                            {occurrence.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Seção 2: Cards Sem Horário */}
              {untimedOccurrences.length > 0 && (
                <section aria-labelledby="untimed-section-heading" className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <h2
                      id="untimed-section-heading"
                      className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Sem horário
                    </h2>
                    <span className="text-xs text-neutral-400 font-normal">
                      ({untimedOccurrences.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {untimedOccurrences.map((occurrence) => {
                      const textColor = getContrastTextColor(occurrence.color);

                      return (
                        <div
                          key={occurrence.occurrenceKey}
                          onClick={() => onOccurrenceClick(occurrence)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOccurrenceClick(occurrence);
                            }
                          }}
                          className="rounded-lg p-3.5 shadow-2xs cursor-pointer transition-all hover:opacity-95 hover:shadow-xs active:scale-[0.99] flex flex-col gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                          style={{
                            backgroundColor: occurrence.color,
                            color: textColor,
                          }}
                          title={occurrence.content}
                        >
                          {occurrence.isRecurring && (
                            <div className="flex items-center justify-end">
                              <span
                                className="inline-flex items-center gap-1 text-[11px] opacity-80"
                                title="Item recorrente"
                              >
                                <Repeat className="w-3 h-3" />
                                <span className="font-normal text-[10px]">Série</span>
                              </span>
                            </div>
                          )}

                          <p className="text-sm font-medium leading-relaxed whitespace-pre-line break-words line-clamp-6">
                            {occurrence.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Ação discreta para criar novo card */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onDayClick(dateString)}
                  className="w-full py-2.5 px-4 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-lg text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo card
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
