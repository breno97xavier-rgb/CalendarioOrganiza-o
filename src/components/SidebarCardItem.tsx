import React from 'react';
import { SidebarCard } from '../types/sidebar';
import { getContrastTextColor } from '../utils/calendarUtils';

interface SidebarCardItemProps {
  card: SidebarCard;
  onClick: (card: SidebarCard) => void;
}

export const SidebarCardItem: React.FC<SidebarCardItemProps> = ({ card, onClick }) => {
  const textColor = getContrastTextColor(card.color);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(card)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(card);
        }
      }}
      title={card.content}
      className="w-full px-2.5 py-2 text-xs font-medium leading-snug rounded-md shadow-2xs select-none cursor-pointer transition-all hover:opacity-95 hover:shadow-xs active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 break-words whitespace-pre-wrap text-left"
      style={{
        backgroundColor: card.color,
        color: textColor,
      }}
    >
      {card.content}
    </div>
  );
};
