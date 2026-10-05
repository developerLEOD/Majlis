import React, { useEffect, useRef } from 'react';
import { Hand } from 'lucide-react';

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
  { emoji: '💡', label: 'Wisdom' },
  { emoji: '🤝', label: 'Respect' },
  { emoji: '🤲', label: 'Gratitude' },
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
  const lastActionTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const handleEmojiClick = (emoji: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastActionTimeRef.current < 350) return;
    lastActionTimeRef.current = now;
    onSelectReaction(emoji);
  };

  const handleHandRaiseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastActionTimeRef.current < 350) return;
    lastActionTimeRef.current = now;
    onToggleHandRaise();
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 mb-1 bg-[#160E09] border border-[#2E1E14] rounded-sm p-3.5 z-50 w-72 select-none text-[#FAF8F5] shadow-2xl animate-in fade-in"
    >
      {/* Hand Raise Button */}
      <div className="pb-2.5 mb-2.5 border-b border-[#2E1E14]">
        <button
          onClick={handleHandRaiseClick}
          className={`flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-semibold transition-colors w-full justify-center shadow-xs ${
            handRaised
              ? 'bg-[#E5A93C] text-[#1F160F] border border-[#C48C28] font-bold'
              : 'bg-[#22160E] hover:bg-[#2F1F15] text-[#FAF8F5] border border-[#3A2619]'
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
          <span>{handRaised ? 'Lower Hand ✋' : 'Raise Hand ✋'}</span>
        </button>
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-5 gap-1.5 py-1">
        {POPULAR_REACTIONS.map((item) => (
          <button
            key={item.emoji}
            onClick={(e) => handleEmojiClick(item.emoji, e)}
            className="w-11 h-9 rounded-sm flex items-center justify-center text-xl hover:bg-[#24170F] transition-colors cursor-pointer"
            title={item.label}
          >
            {item.emoji}
          </button>
        ))}
      </div>

      <div className="pt-2 mt-1 border-t border-[#2E1E14] flex items-center justify-between text-[11px] text-[#8A7A6D]">
        <span className="flex items-center gap-1 font-mono text-[10px]">
          <span className="text-[#E5A93C]">✦</span> Click to react live
        </span>
        <button
          onClick={onClose}
          className="text-[#8A7A6D] hover:text-[#FAF8F5] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
