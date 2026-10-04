import React, { useEffect, useRef, useState } from 'react';
import { Crown, Lock, MessageSquare, Send, X } from 'lucide-react';
import { ChatMessage } from '../types/meeting';
import { IslamicStarRosette } from './common/IslamicStarRosette';

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
    <div className="w-80 sm:w-88 h-full bg-[#160E09] border-l border-[#2E1E14] flex flex-col z-30 select-none shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-[#2E1E14] flex items-center justify-between bg-[#110A05]">
        <div className="flex items-center gap-2.5">
          <IslamicStarRosette size={20} variant="full" />
          <h3 className="text-xs font-bold text-[#FFFCF5]">
            Majlis Discussion
          </h3>
          <span className="text-[10px] bg-[#22160E] text-[#E9A83A] px-1.5 py-0.5 rounded-sm font-mono border border-[#3A2619]">
            {messages.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#8A7A6D] hover:text-[#FFFCF5] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notice if chat paused */}
      {!chatEnabled && (
        <div className="px-3.5 py-2 bg-[#A83245]/20 border-b border-[#A83245]/40 text-[11px] text-[#E9A83A] flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Discussion paused by facilitator</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8A7A6D]">
            <MessageSquare className="w-6 h-6 mb-2 text-[#E9A83A]/60" />
            <p className="text-xs font-bold text-[#FFFCF5]">No reflections shared yet</p>
            <p className="text-[11px] text-[#8A7A6D] mt-1 leading-relaxed max-w-xs">
              Contribute reflections, ask questions, or share classical references.
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
                <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                  <span className="font-semibold text-[#FFFCF5]">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  {msg.isHost && (
                    <span className="flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-bold bg-[#E9A83A] text-[#1E140C] rounded-sm">
                      <Crown className="w-2.5 h-2.5" /> Facilitator
                    </span>
                  )}
                  <span className="text-[10px] text-[#8A7A6D] font-mono ml-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`p-2.5 rounded-sm text-xs max-w-[88%] break-words leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-[#075E4A] text-[#FFFCF5] border border-[#19A6A0]/50'
                      : 'bg-[#22160E] text-[#FFFCF5] border border-[#362316]'
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

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3.5 border-t border-[#2E1E14] bg-[#110A05] flex gap-2">
        <input
          type="text"
          value={inputText}
          disabled={!canPost}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={canPost ? 'Share a reflection...' : 'Discussion paused'}
          className="flex-1 bg-[#1E130B] disabled:opacity-50 border border-[#362316] rounded-sm px-3.5 py-2 text-xs text-[#FFFCF5] placeholder-[#8A7A6D] focus:outline-none focus:border-[#075E4A]"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !canPost}
          className="px-3.5 py-2 bg-[#075E4A] disabled:opacity-40 hover:bg-[#05493A] text-[#FFFCF5] rounded-sm transition-colors text-xs font-semibold shrink-0 border border-[#19A6A0]/50"
        >
          <Send className="w-3.5 h-3.5 text-[#E9A83A]" />
        </button>
      </form>
    </div>
  );
};
