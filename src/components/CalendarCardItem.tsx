import React from 'react';
import { Repeat } from 'lucide-react';
import { CalendarOccurrence } from '../types/calendar';
import { getContrastTextColor } from '../utils/calendarUtils';

interface CalendarCardItemProps {
  occurrence: CalendarOccurrence;
  onOccurrenceClick?: (occurrence: CalendarOccurrence) => void;
  compact?: boolean;
}

export const CalendarCardItem: React.FC<CalendarCardItemProps> = ({
  occurrence,
  onOccurrenceClick,
  compact = true,
}) => {
  const textColor = getContrastTextColor(occurrence.color);
  const formattedTime = occurrence.time ? occurrence.time.slice(0, 5) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // Impede rigorosamente que o clique no card propague para a célula do dia
        e.stopPropagation();
        onOccurrenceClick?.(occurrence);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onOccurrenceClick?.(occurrence);
        }
      }}
      title={occurrence.content}
      className={`${
        compact
          ? 'px-1 sm:px-1.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] items-center rounded-xs sm:rounded'
          : 'px-2 py-1.5 text-xs items-start rounded'
      } font-medium leading-tight flex gap-1 sm:gap-1.5 shadow-2xs select-none cursor-pointer transition-all hover:opacity-95 hover:shadow-xs active:scale-[0.99] focus:outline-none focus-visible:ring-1 sm:focus-visible:ring-2 focus-visible:ring-neutral-900`}
      style={{
        backgroundColor: occurrence.color,
        color: textColor,
      }}
    >
      {/* Indicador discreto de recorrência */}
      {occurrence.isRecurring && (
        <Repeat
          className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0 opacity-80 mt-0.5"
          aria-label="Item recorrente"
        />
      )}

      {formattedTime && (
        <span className="font-semibold shrink-0 opacity-90 tabular-nums text-[8px] sm:text-[10px]">
          {formattedTime}
        </span>
      )}

      <span className={compact ? 'truncate flex-1' : 'line-clamp-2 break-words flex-1 leading-snug'}>
        {occurrence.content}
      </span>
    </div>
  );
};
