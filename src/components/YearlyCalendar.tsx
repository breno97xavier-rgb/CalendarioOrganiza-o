import React, { useMemo } from 'react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarOccurrence } from '../types/calendar';

interface YearlyCalendarProps {
  currentDate: Date;
  occurrencesByDate: Record<string, CalendarOccurrence[]>;
  onDayClick: (dateString: string) => void;
  onMonthClick: (year: number, monthIndex: number) => void;
}

const WEEK_DAYS_HEADER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export const YearlyCalendar: React.FC<YearlyCalendarProps> = ({
  currentDate,
  occurrencesByDate,
  onDayClick,
  onMonthClick,
}) => {
  const year = currentDate.getFullYear();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Prepara a estrutura dos 12 meses
  const monthsData = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = new Date(year, monthIndex, 1, 12, 0, 0);
      const rawMonthName = format(monthDate, 'MMMM', { locale: ptBR });
      const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

      // Quantidade de dias no mês (suporta bissexto)
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      // Deslocamento para início na segunda-feira (0 = Segunda, ..., 6 = Domingo)
      const firstDayOfWeek = (monthDate.getDay() + 6) % 7;

      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNumber = i + 1;
        const dateString = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        return {
          dayNumber,
          dateString,
          isTodayDate: dateString === todayStr,
        };
      });

      return {
        monthIndex,
        monthName,
        firstDayOfWeek,
        days,
      };
    });
  }, [year, todayStr]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {/* Grade de 12 mini-calendários: 4 cols (xl), 3 cols (lg), 2 cols (sm), 1 col (mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {monthsData.map(({ monthIndex, monthName, firstDayOfWeek, days }) => (
              <div
                key={monthIndex}
                className="bg-white border border-neutral-200/90 rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col hover:border-neutral-300 transition-colors"
              >
                {/* Cabeçalho do Mês (Clicável para ir à visualização Mês) */}
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onMonthClick(year, monthIndex)}
                    className="text-sm font-semibold text-neutral-800 hover:text-neutral-950 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded cursor-pointer"
                    title={`Abrir visualização mensal de ${monthName} de ${year}`}
                  >
                    {monthName}
                  </button>
                </div>

                {/* Cabeçalho dos dias da semana (S T Q Q S S D) */}
                <div className="grid grid-cols-7 gap-1 mb-1.5">
                  {WEEK_DAYS_HEADER.map((label, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] font-semibold text-neutral-400 text-center uppercase tracking-wider py-0.5"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Grid dos dias do mês */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Espaços vazios para alinhamento da primeira semana */}
                  {Array.from({ length: firstDayOfWeek }).map((_, emptyIdx) => (
                    <div key={`empty-${emptyIdx}`} className="h-9" aria-hidden="true" />
                  ))}

                  {/* Células dos dias */}
                  {days.map(({ dayNumber, dateString, isTodayDate }) => {
                    const occurrences = occurrencesByDate[dateString] || [];
                    const count = occurrences.length;
                    const visibleDots = occurrences.slice(0, 3);
                    const remainder = count - 3;

                    const accessibleLabel =
                      count > 0
                        ? `${dayNumber} de ${monthName} de ${year}, ${count} ${count === 1 ? 'card' : 'cards'}`
                        : `${dayNumber} de ${monthName} de ${year}, nenhum card`;

                    const titleText =
                      count > 0
                        ? `${dayNumber} de ${monthName} de ${year}: ${count} card${count > 1 ? 's' : ''}`
                        : undefined;

                    return (
                      <div
                        key={dateString}
                        role="button"
                        tabIndex={0}
                        onClick={() => onDayClick(dateString)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onDayClick(dateString);
                          }
                        }}
                        aria-label={accessibleLabel}
                        aria-current={isTodayDate ? 'date' : undefined}
                        title={titleText}
                        className="group relative h-9 flex flex-col items-center justify-start pt-1 rounded hover:bg-neutral-100/80 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                      >
                        {/* Número do dia */}
                        <span
                          className={`w-5 h-5 flex items-center justify-center text-xs rounded-full leading-none transition-colors ${
                            isTodayDate
                              ? 'bg-neutral-900 text-white font-bold shadow-2xs'
                              : 'text-neutral-700 font-medium group-hover:text-neutral-950'
                          }`}
                        >
                          {dayNumber}
                        </span>

                        {/* Indicadores de cores dos cards */}
                        {count > 0 && (
                          <div className="flex items-center justify-center gap-0.5 mt-0.5 h-2 w-full max-w-[28px] overflow-hidden">
                            {visibleDots.map((occ, dotIdx) => (
                              <span
                                key={occ.occurrenceKey || `${occ.cardId}-${dotIdx}`}
                                className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: occ.color }}
                              />
                            ))}
                            {remainder > 0 && (
                              <span className="text-[8px] font-bold text-neutral-500 leading-none">
                                +{remainder}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
