import React from 'react';
import { CalendarDay, CalendarOccurrence } from '../types/calendar';
import { WEEK_DAYS } from '../utils/calendarUtils';
import { sortOccurrencesForDay } from '../utils/recurrenceUtils';
import { CalendarCardItem } from './CalendarCardItem';

interface MonthlyCalendarProps {
  days: CalendarDay[];
  occurrencesByDate: Record<string, CalendarOccurrence[]>;
  onDayClick: (dateString: string) => void;
  onOccurrenceClick?: (occurrence: CalendarOccurrence) => void;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  days,
  occurrencesByDate,
  onDayClick,
  onOccurrenceClick,
}) => {
  const totalWeeks = Math.ceil(days.length / 7);

  return (
    <div className="flex-1 flex flex-col h-full bg-white select-none overflow-hidden">
      {/* Cabeçalho dos Dias da Semana (SEG a DOM) */}
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 shrink-0">
        {WEEK_DAYS.map((dayName) => (
          <div
            key={dayName}
            className="py-1.5 sm:py-2.5 text-center text-[9px] sm:text-[11px] font-semibold tracking-wider text-neutral-500 uppercase border-r last:border-r-0 border-neutral-200"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Grade de Dias do Mês */}
      <div
        className="flex-1 grid grid-cols-7 divide-x divide-neutral-200 border-b border-neutral-200 bg-neutral-200 gap-px min-h-0"
        style={{
          gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))`,
        }}
      >
        {days.map((day) => {
          const rawDayOccurrences = occurrencesByDate[day.dateString] || [];
          const sortedOccurrences = sortOccurrencesForDay(rawDayOccurrences);

          return (
            <div
              key={day.dateString}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(day.dateString)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDayClick(day.dateString);
                }
              }}
              aria-label={`${day.dayOfMonth} de ${day.dateString}, ${sortedOccurrences.length} cards`}
              aria-current={day.isToday ? 'date' : undefined}
              className={`p-1 sm:p-1.5 lg:p-2 flex flex-col transition-colors relative cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:z-10 ${
                day.isCurrentMonth
                  ? 'bg-white hover:bg-neutral-50/80 text-neutral-800'
                  : 'bg-neutral-50/70 hover:bg-neutral-100/70 text-neutral-400'
              }`}
            >
              {/* Indicador Numérico do Dia */}
              <div className="flex items-center justify-between mb-0.5 sm:mb-1 shrink-0">
                <span
                  className={`inline-flex items-center justify-center text-[10px] sm:text-xs w-5 h-5 sm:w-6 sm:h-6 rounded-full font-medium transition-colors ${
                    day.isToday
                      ? 'bg-neutral-900 text-white font-semibold shadow-2xs'
                      : day.isCurrentMonth
                      ? 'text-neutral-700 group-hover:text-neutral-950'
                      : 'text-neutral-400'
                  }`}
                >
                  {day.dayOfMonth}
                </span>

                {day.isToday && (
                  <span className="text-[9px] sm:text-[10px] font-medium text-neutral-500 pr-0.5 sm:pr-1">
                    Hoje
                  </span>
                )}
              </div>

              {/* Área interna de Ocorrências com rolagem suave */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-0.5 sm:space-y-1 pr-0.5 custom-scrollbar">
                {sortedOccurrences.map((occurrence) => (
                  <CalendarCardItem
                    key={occurrence.occurrenceKey}
                    occurrence={occurrence}
                    onOccurrenceClick={onOccurrenceClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
