import React from 'react';
import { CalendarDay, CalendarOccurrence } from '../types/calendar';
import { WEEK_DAYS } from '../utils/calendarUtils';
import { sortOccurrencesForDay } from '../utils/recurrenceUtils';
import { CalendarCardItem } from './CalendarCardItem';

interface WeeklyCalendarProps {
  days: CalendarDay[];
  occurrencesByDate: Record<string, CalendarOccurrence[]>;
  onDayClick: (dateString: string) => void;
  onOccurrenceClick: (occurrence: CalendarOccurrence) => void;
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  days,
  occurrencesByDate,
  onDayClick,
  onOccurrenceClick,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white select-none">
      {/* Scroll horizontal LOCAL para telas estreitas mantendo colunas com largura mínima legível */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 custom-scrollbar">
        <div className="h-full min-w-full w-max md:w-full grid grid-cols-7 divide-x divide-neutral-200 min-h-0">
          {days.map((day, index) => {
            const occurrences = occurrencesByDate[day.dateString] || [];
            const sortedOccurrences = sortOccurrencesForDay(occurrences);
            const weekDayLabel = WEEK_DAYS[index] || '';

            return (
              <div
                key={day.dateString}
                className="min-w-[120px] md:min-w-0 flex flex-col min-h-0 h-full overflow-hidden group/col"
                aria-label={`${weekDayLabel}, ${day.dayOfMonth}`}
              >
                {/* Cabeçalho da Coluna do Dia */}
                <div
                  className={`h-11 sm:h-12 border-b border-neutral-200 px-2 sm:px-3 flex items-center justify-between shrink-0 ${
                    day.isToday ? 'bg-neutral-50/80' : 'bg-white'
                  }`}
                >
                  <span
                    className={`text-[11px] sm:text-xs font-semibold tracking-wider ${
                      day.isToday ? 'text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    {weekDayLabel}
                  </span>

                  <div
                    className={`flex items-center justify-center text-xs sm:text-sm ${
                      day.isToday
                        ? 'w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-neutral-900 text-white font-bold shadow-2xs'
                        : 'text-neutral-800 font-semibold'
                    }`}
                    aria-current={day.isToday ? 'date' : undefined}
                  >
                    {day.dayOfMonth}
                  </div>
                </div>

                {/* Corpo da Coluna: Lista vertical de cards do dia */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onDayClick(day.dateString)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onDayClick(day.dateString);
                    }
                  }}
                  className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1.5 min-h-0 bg-white hover:bg-neutral-50/40 transition-colors cursor-pointer custom-scrollbar focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  title={`Clique para criar card em ${day.dateString}`}
                >
                  {sortedOccurrences.map((occurrence) => (
                    <CalendarCardItem
                      key={occurrence.occurrenceKey}
                      occurrence={occurrence}
                      onOccurrenceClick={onOccurrenceClick}
                      compact={false}
                    />
                  ))}

                  {sortedOccurrences.length === 0 && (
                    <div className="h-full min-h-16 flex items-center justify-center opacity-0 group-hover/col:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-[11px] text-neutral-400 font-medium">
                        + Novo card
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
