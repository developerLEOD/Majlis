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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="relative w-full max-w-sm bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl shadow-xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
              The Wisdom Lounge
            </span>
            <h2 className="text-lg font-bold text-[#3C230B] flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#D4AF37]" /> Start Majlis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E7E73] hover:text-[#3C230B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Facilitator Authorization Check */}
        {!isFacilitator ? (
          <div className="p-4 bg-[#F5F2EB] border border-[#E6DFD5] rounded-xl space-y-3 text-xs">
            <div className="flex items-start gap-2.5 text-[#3C230B] font-semibold">
              <Shield className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
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
              className="w-full py-2 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Sign In as Facilitator</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] flex items-center gap-2 font-medium">
              <Crown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Facilitator Active: <strong>{user?.email}</strong></span>
            </div>

            <div>
              <label className="font-semibold text-[#3C230B] block mb-1">
                Majlis Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly Reflection & Inquiry"
                className="w-full bg-white border border-[#D9D0C3] rounded-xl px-3 py-2 text-xs text-[#241710] focus:outline-none focus:border-[#3C230B]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#3C230B] block mb-1">
                Facilitator Display Name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Facilitator Name..."
                className="w-full bg-white border border-[#D9D0C3] rounded-xl px-3 py-2 text-xs text-[#241710] focus:outline-none focus:border-[#3C230B]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E6DFD5]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-[#8E7E73] hover:text-[#3C230B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] font-semibold text-xs rounded-xl shadow-xs transition"
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
