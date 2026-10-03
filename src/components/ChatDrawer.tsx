import React, { useEffect, useRef, useState } from 'react';
import { Crown, Lock, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { ChatMessage } from '../types/meeting';

interface ChatDrawerProps {
  messages: ChatMessage[];
  currentUserId: string;
  isHost?: boolean;
  chatEnabled?: boolean;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  isHost = false,
  chatEnabled = true,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!chatEnabled && !isHost) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const canPost = chatEnabled || isHost;

  return (
    <div className="w-80 sm:w-96 h-full bg-[#1A1410] border-l border-[#3C230B]/60 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#3C230B]/60 flex items-center justify-between bg-[#140F0C]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="font-editorial text-base font-bold text-[#FFFCF5]">
            Majlis Discussion
          </h3>
          <span className="text-[10px] bg-[#2B1706] text-[#E0C2A6] px-2 py-0.5 rounded-full font-mono">
            {messages.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-[#8E7E73] hover:text-[#FFFCF5] rounded-lg hover:bg-[#2B1706] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notice if chat paused by host */}
      {!chatEnabled && (
        <div className="px-4 py-2 bg-amber-950/50 border-b border-amber-900/40 text-[11px] text-amber-300 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Discussion paused by facilitator {isHost && '(You can still post)'}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8E7E73]">
            <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-[#68594E]" />
            <p className="text-xs font-semibold text-[#D9D0C3]">No remarks shared yet</p>
            <p className="text-[11px] text-[#8E7E73] mt-1 leading-relaxed max-w-xs">
              Contribute reflections, ask questions of clarification, or share textual references.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                  <span className="font-medium text-[#D9D0C3]">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  {msg.isHost && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded">
                      <Crown className="w-2.5 h-2.5" /> Facilitator
                    </span>
                  )}
                  <span className="text-[10px] text-[#68594E] ml-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-[#3C230B] text-[#FFFCF5] rounded-tr-xs border border-[#D4AF37]/20 shadow-xs'
                      : 'bg-[#241710] text-[#E0C2A6] border border-[#3C230B]/80 rounded-tl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick adab & contemplation reactions */}
      {canPost && (
        <div className="px-4 py-2 bg-[#140F0C] border-t border-[#3C230B]/40 flex items-center gap-2">
          {['🤲', '💡', '📖', '👍', '👏', '✨'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => setInputText((prev) => prev + emoji)}
              className="hover:scale-125 transition-transform text-sm p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#3C230B]/60 bg-[#140F0C] flex gap-2">
        <input
          type="text"
          value={inputText}
          disabled={!canPost}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={canPost ? 'Share a reflection or question...' : 'Chat is disabled by facilitator'}
          className="flex-1 bg-[#1E1712] disabled:opacity-50 border border-[#3C230B] rounded-xl px-3.5 py-2 text-xs text-[#FFFCF5] placeholder-[#8E7E73] focus:outline-none focus:border-[#D4AF37] transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !canPost}
          className="p-2.5 bg-[#3C230B] disabled:opacity-40 hover:bg-[#2B1706] text-[#E0C2A6] rounded-xl transition shadow-xs"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
