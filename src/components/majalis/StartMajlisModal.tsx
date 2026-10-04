import React, { useState } from 'react';
import { Crown, Shield, X, Key } from 'lucide-react';
import { MajlisSession } from '../../types/meeting';
import { useAuth } from '../../context/AuthContext';

interface StartMajlisModalProps {
  userName: string;
  onClose: () => void;
  onStartSession: (session: MajlisSession) => void;
  onOpenAuthModal: () => void;
}

export const StartMajlisModal: React.FC<StartMajlisModalProps> = ({
  userName,
  onClose,
  onStartSession,
  onOpenAuthModal,
}) => {
  const { user, isFacilitator } = useAuth();
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState(userName || user?.displayName || 'Facilitator');

  const generateRoomId = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 9; i++) {
      if (i > 0 && i % 3 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFacilitator) return;
    if (!title.trim()) return;

    const roomId = generateRoomId();

    const newSession: MajlisSession = {
      id: 'session_' + Date.now(),
      roomId,
      title: title.trim(),
      scheduledAt: 'Happening Now',
      status: 'live',
      hostName: hostName.trim() || 'Facilitator',
    };

    onStartSession(newSession);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="relative w-full max-w-sm bg-[#FFFCF5] border border-[#302116] rounded-md shadow-xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
              The Wisdom Lounge
            </span>
            <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2 mt-0.5">
              <Crown className="w-4 h-4 text-[#E9A83A]" /> Start Majlis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E7E73] hover:text-[#1C1917] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Facilitator Authorization Check */}
        {!isFacilitator ? (
          <div className="p-4 bg-[#F5F2EB] border border-[#E6DFD5] rounded-sm space-y-3 text-xs">
            <div className="flex items-start gap-2.5 text-[#1C1917] font-semibold">
              <Shield className="w-4 h-4 text-[#E9A83A] shrink-0 mt-0.5" />
              <div>
                Facilitator Sign-In Required
              </div>
            </div>
            <p className="text-[11px] text-[#68594E] leading-relaxed">
              Hosting a live Majlis session requires signing in with a designated facilitator account.
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
              className="w-full py-2 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] font-semibold text-xs rounded-sm transition-colors flex items-center justify-center gap-1.5 border border-[#19A6A0]/40"
            >
              <Key className="w-3.5 h-3.5 text-[#E9A83A]" />
              <span>Sign In as Facilitator</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="p-2.5 bg-[#075E4A]/10 border border-[#075E4A]/30 text-[#075E4A] rounded-sm text-[11px] flex items-center gap-2 font-medium">
              <Crown className="w-3.5 h-3.5 text-[#075E4A] shrink-0" />
              <span>Facilitator Active: <strong>{user?.email}</strong></span>
            </div>

            <div>
              <label className="font-semibold text-[#1C1917] block mb-1">
                Majlis Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly Reflection & Inquiry"
                className="w-full bg-[#FFFCF5] border border-[#D9D0C3] rounded-sm px-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#075E4A]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#1C1917] block mb-1">
                Facilitator Display Name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Facilitator Name..."
                className="w-full bg-[#FFFCF5] border border-[#D9D0C3] rounded-sm px-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#075E4A]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E6DFD5]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-[#8E7E73] hover:text-[#1C1917] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] font-semibold text-xs rounded-sm border border-[#19A6A0]/40 transition-colors"
              >
                Start Majlis
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
