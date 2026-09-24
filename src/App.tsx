/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, addYears, subYears, format } from 'date-fns';
import { CalendarView, CalendarCard, CalendarOccurrence, RecurrenceType, RecurrenceUnit } from './types/calendar';
import { getCalendarDays, getWeekDays, COLOR_PALETTE } from './utils/calendarUtils';
import { expandRecurringCards } from './utils/recurrenceUtils';
import { calendarCardService } from './services/calendarCardService';
import { CalendarHeader } from './components/CalendarHeader';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { DailyCalendar } from './components/DailyCalendar';
import { YearlyCalendar } from './components/YearlyCalendar';
import { SidebarPanel } from './components/SidebarPanel';
import { CardEditorModal, CardEditorMode, CardEditorFormData } from './components/CardEditorModal';
import { CardDetailModal } from './components/CardDetailModal';

export default function App() {
  // Data de referência calculada dinamicamente a partir do momento atual
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Visualização selecionada (inicialmente 'month')
  const [selectedView, setSelectedView] = useState<CalendarView>('month');

  // Estado do Drawer lateral em telas mobile / tablet
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Registros-base carregados do Supabase (NÃO materializados)
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estado do Modal de Detalhes da Ocorrência
  const [selectedOccurrenceForDetail, setSelectedOccurrenceForDetail] = useState<CalendarOccurrence | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Estado do Editor Unificado de Cards (CREATE / EDIT / COPY)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<CardEditorMode>('CREATE');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editorDate, setEditorDate] = useState<string>('');
  const [editorColor, setEditorColor] = useState<string>(COLOR_PALETTE[0].hex);
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorTime, setEditorTime] = useState<string | null>(null);
  const [editorRecurrenceType, setEditorRecurrenceType] = useState<RecurrenceType>('none');
  const [editorRecurrenceInterval, setEditorRecurrenceInterval] = useState<number>(1);
  const [editorRecurrenceUnit, setEditorRecurrenceUnit] = useState<RecurrenceUnit | null>(null);
  const [editorRecurrenceDays, setEditorRecurrenceDays] = useState<number[] | null>(null);
  const [editorRecurrenceEndDate, setEditorRecurrenceEndDate] = useState<string | null>(null);

  // Matriz de dias calculada para a grade do mês atual
  const calendarDays = useMemo(() => {
    return getCalendarDays(currentDate);
  }, [currentDate]);

  // 7 dias calculados para a visualização semanal
  const weekDays = useMemo(() => {
    return getWeekDays(currentDate);
  }, [currentDate]);

  // Intervalo visível da grade atual (respeitando a visualização selecionada)
  const visibleInterval = useMemo(() => {
    if (selectedView === 'year') {
      const year = currentDate.getFullYear();
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }

    if (selectedView === 'day') {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      return {
        startDate: dateStr,
        endDate: dateStr,
      };
    }

    if (selectedView === 'week') {
      if (weekDays.length === 0) return null;
      return {
        startDate: weekDays[0].dateString,
        endDate: weekDays[weekDays.length - 1].dateString,
      };
    }

    if (calendarDays.length === 0) return null;
    return {
      startDate: calendarDays[0].dateString,
      endDate: calendarDays[calendarDays.length - 1].dateString,
    };
  }, [selectedView, currentDate, weekDays, calendarDays]);

  // Carrega registros-base do Supabase para o intervalo visível
  const fetchCards = useCallback(async () => {
    if (!visibleInterval) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await calendarCardService.getCards(
        visibleInterval.startDate,
        visibleInterval.endDate
      );
      setCards(data);
    } catch (err: unknown) {
      console.error('Falha ao carregar cards:', err);
      setLoadError('Não foi possível carregar os cards do calendário.');
    } finally {
      setIsLoading(false);
    }
  }, [visibleInterval]);

  // Recarregar sempre que o intervalo visível mudar
  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // MOTOR DE EXPANSÃO: Gera ocorrências virtuais exclusivamente para o intervalo visível
  const occurrencesByDate = useMemo(() => {
    if (!visibleInterval) return {};
    const expandedOccurrences = expandRecurringCards(
      cards,
      visibleInterval.startDate,
      visibleInterval.endDate
    );

    const map: Record<string, CalendarOccurrence[]> = {};
    for (const occ of expandedOccurrences) {
      if (!map[occ.occurrenceDate]) {
        map[occ.occurrenceDate] = [];
      }
      map[occ.occurrenceDate].push(occ);
    }
    return map;
  }, [cards, visibleInterval]);

  // Navegação temporal adaptada à visualização atual
  const handlePreviousPeriod = () => {
    if (selectedView === 'year') {
      setCurrentDate((prev) => subYears(prev, 1));
    } else if (selectedView === 'day') {
      setCurrentDate((prev) => subDays(prev, 1));
    } else if (selectedView === 'week') {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => subMonths(prev, 1));
    }
  };

  const handleNextPeriod = () => {
    if (selectedView === 'year') {
      setCurrentDate((prev) => addYears(prev, 1));
    } else if (selectedView === 'day') {
      setCurrentDate((prev) => addDays(prev, 1));
    } else if (selectedView === 'week') {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Navegação a partir do Ano: clicar em um dia navega para a visualização Dia
  const handleYearDayClick = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, d, 12, 0, 0));
    setSelectedView('day');
  };

  // Navegação a partir do Ano: clicar no nome do mês navega para a visualização Mês
  const handleYearMonthClick = (year: number, monthIndex: number) => {
    setCurrentDate(new Date(year, monthIndex, 1, 12, 0, 0));
    setSelectedView('month');
  };

  // Clique em um dia do calendário (CRIAÇÃO)
  const handleDayClick = (dateString: string) => {
    setEditorMode('CREATE');
    setEditingCardId(null);
    setEditorDate(dateString);
    setEditorColor(COLOR_PALETTE[0].hex);
    setEditorContent('');
    setEditorTime(null);
    setEditorRecurrenceType('none');
    setEditorRecurrenceInterval(1);
    setEditorRecurrenceUnit(null);
    setEditorRecurrenceDays(null);
    setEditorRecurrenceEndDate(null);
    setIsEditorOpen(true);
  };

  // Clique em uma ocorrência (Abrir Modal de Detalhes)
  const handleOccurrenceClick = (occurrence: CalendarOccurrence) => {
    setSelectedOccurrenceForDetail(occurrence);
    setIsDetailOpen(true);
  };

  // Ação de Editar a partir dos detalhes
  const handleStartEdit = (card: CalendarCard) => {
    setIsDetailOpen(false);
    setEditorMode('EDIT');
    setEditingCardId(card.id);
    setEditorDate(card.date);
    setEditorColor(card.color);
    setEditorContent(card.content);
    setEditorTime(card.time);
    setEditorRecurrenceType(card.recurrence_type);
    setEditorRecurrenceInterval(card.recurrence_interval);
    setEditorRecurrenceUnit(card.recurrence_unit);
    setEditorRecurrenceDays(card.recurrence_days);
    setEditorRecurrenceEndDate(card.recurrence_end_date);
    setIsEditorOpen(true);
  };

  // Ação de Copiar a partir dos detalhes
  const handleStartCopy = (card: CalendarCard) => {
    setIsDetailOpen(false);
    setEditorMode('COPY');
    setEditingCardId(null);
    setEditorDate(card.date);
    setEditorColor(card.color);
    setEditorContent(card.content);
    setEditorTime(card.time);
    setEditorRecurrenceType(card.recurrence_type);
    setEditorRecurrenceInterval(card.recurrence_interval);
    setEditorRecurrenceUnit(card.recurrence_unit);
    setEditorRecurrenceDays(card.recurrence_days);
    setEditorRecurrenceEndDate(card.recurrence_end_date);
    setIsEditorOpen(true);
  };

  // Ação de Excluir card/série confirmada
  const handleDeleteCard = async (cardId: string) => {
    await calendarCardService.deleteCard(cardId);
    await fetchCards();
  };

  // Submissão do editor (CREATE / EDIT / COPY)
  const handleSaveEditor = async (formData: CardEditorFormData) => {
    if (editorMode === 'EDIT' && editingCardId) {
      await calendarCardService.updateCard(editingCardId, {
        content: formData.content,
        color: formData.color,
        date: formData.date,
        time: formData.time,
        recurrence_type: formData.recurrence_type,
        recurrence_interval: formData.recurrence_interval,
        recurrence_unit: formData.recurrence_unit,
        recurrence_days: formData.recurrence_days,
        recurrence_end_date: formData.recurrence_end_date,
      });
    } else {
      // CREATE ou COPY criam novo registro independente
      await calendarCardService.createCard({
        content: formData.content,
        color: formData.color,
        date: formData.date,
        time: formData.time,
        recurrence_type: formData.recurrence_type,
        recurrence_interval: formData.recurrence_interval,
        recurrence_unit: formData.recurrence_unit,
        recurrence_days: formData.recurrence_days,
        recurrence_end_date: formData.recurrence_end_date,
      });
    }

    // Atualiza a visualização mensal a partir do Supabase
    await fetchCards();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-100 text-neutral-900 overflow-hidden font-sans antialiased">
      {/* A) Cabeçalho */}
      <CalendarHeader
        currentDate={currentDate}
        onPreviousPeriod={handlePreviousPeriod}
        onNextPeriod={handleNextPeriod}
        onToday={handleToday}
        selectedView={selectedView}
        onViewChange={setSelectedView}
        isLoading={isLoading}
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* Alerta discreto em caso de falha de carregamento */}
      {loadError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <span>{loadError}</span>
          <button
            onClick={fetchCards}
            className="font-medium underline hover:text-amber-950 cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Área Central: Calendário dominante e Painel lateral */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* B) Área Principal do Calendário (Elemento Dominante) */}
        <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden min-h-0">
          {selectedView === 'year' ? (
            <YearlyCalendar
              currentDate={currentDate}
              occurrencesByDate={occurrencesByDate}
              onDayClick={handleYearDayClick}
              onMonthClick={handleYearMonthClick}
            />
          ) : selectedView === 'day' ? (
            <DailyCalendar
              currentDate={currentDate}
              occurrences={occurrencesByDate[format(currentDate, 'yyyy-MM-dd')] || []}
              onDayClick={handleDayClick}
              onOccurrenceClick={handleOccurrenceClick}
            />
          ) : selectedView === 'week' ? (
            <WeeklyCalendar
              days={weekDays}
              occurrencesByDate={occurrencesByDate}
              onDayClick={handleDayClick}
              onOccurrenceClick={handleOccurrenceClick}
            />
          ) : (
            <MonthlyCalendar
              days={calendarDays}
              occurrencesByDate={occurrencesByDate}
              onDayClick={handleDayClick}
              onOccurrenceClick={handleOccurrenceClick}
            />
          )}
        </main>

        {/* C) Painel Lateral Direito (Lembretes e Metas) */}
        <SidebarPanel
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Modal de Detalhes da Ocorrência */}
      <CardDetailModal
        occurrence={selectedOccurrenceForDetail}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={handleStartEdit}
        onCopy={handleStartCopy}
        onDelete={handleDeleteCard}
      />

      {/* Modal / Editor Único de Cards (CREATE, EDIT, COPY) */}
      <CardEditorModal
        isOpen={isEditorOpen}
        mode={editorMode}
        initialDate={editorDate}
        initialColor={editorColor}
        initialContent={editorContent}
        initialTime={editorTime}
        initialRecurrenceType={editorRecurrenceType}
        initialRecurrenceInterval={editorRecurrenceInterval}
        initialRecurrenceUnit={editorRecurrenceUnit}
        initialRecurrenceDays={editorRecurrenceDays}
        initialRecurrenceEndDate={editorRecurrenceEndDate}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveEditor}
      />
    </div>
  );
}
