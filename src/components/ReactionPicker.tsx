import React, { useEffect, useRef } from 'react';
import { Hand, Sparkles, X } from 'lucide-react';

interface ReactionPickerProps {
  onSelectReaction: (emoji: string) => void;
  onToggleHandRaise: () => void;
  handRaised: boolean;
  onClose: () => void;
}

const POPULAR_REACTIONS = [
  { emoji: '❤️', label: 'Heart' },
  { emoji: '👏', label: 'Applause' },
  { emoji: '👍', label: 'Thumbs Up' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '😂', label: 'Joy' },
  { emoji: '💡', label: 'Wisdom' },
  { emoji: '🤝', label: 'Respect' },
  { emoji: '🤲', label: 'Gratitude' },
  { emoji: '🔥', label: 'Inspiring' },
  { emoji: '💯', label: '100%' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '☕', label: 'Chai' },
];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelectReaction,
  onToggleHandRaise,
  handRaised,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 mb-2 bg-[#1A1410]/95 backdrop-blur-md border border-[#3C230B] rounded-2xl shadow-2xl p-3 z-50 w-72 sm:w-80 animate-in fade-in zoom-in-95 duration-150 select-none text-[#FFFCF5]"
    >
      {/* Header with Hand Raise Action */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3C230B]/60">
        <button
          onClick={() => {
            onToggleHandRaise();
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition w-full justify-center ${
            handRaised
              ? 'bg-[#D4AF37] text-[#241710] shadow-sm font-bold'
              : 'bg-[#241710] hover:bg-[#3C230B] text-[#E0C2A6] border border-[#3C230B]'
          }`}
        >
          <Hand className={`w-4 h-4 ${handRaised ? 'animate-bounce text-[#241710]' : ''}`} />
          <span>{handRaised ? 'Lower Hand ✋' : 'Raise Hand ✋'}</span>
        </button>
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-6 gap-1.5 py-1">
        {POPULAR_REACTIONS.map((item) => (
          <button
            key={item.emoji}
            onClick={() => onSelectReaction(item.emoji)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl hover:bg-[#2B1706] hover:scale-125 active:scale-95 transition-all duration-150 cursor-pointer"
            title={item.label}
          >
            {item.emoji}
          </button>
        ))}
      </div>

      <div className="pt-2 mt-1 border-t border-[#3C230B]/40 flex items-center justify-between text-[11px] text-[#A6978A] px-1">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#D4AF37]" /> Click to react live
        </span>
        <button
          onClick={onClose}
          className="text-[#8E7E73] hover:text-[#E0C2A6] text-[11px]"
        >
          Close
        </button>
      </div>
    </div>
  );
};
