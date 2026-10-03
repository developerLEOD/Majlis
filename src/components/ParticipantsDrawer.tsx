import React, { useState } from 'react';
import {
  Camera,
  Crown,
  Hand,
  Lock,
  Mic,
  MicOff,
  MoreVertical,
  Shield,
  Unlock,
  UserMinus,
  Users,
  VideoOff,
  X,
} from 'lucide-react';
import { Participant } from '../types/meeting';

interface ParticipantsDrawerProps {
  participants: Participant[];
  currentUserId: string;
  isHost: boolean;
  isLocked: boolean;
  onMuteAll: () => void;
  onToggleLock: () => void;
  onKickUser: (userId: string) => void;
  onOpenInvite: () => void;
  onClose: () => void;
}

export const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  participants,
  currentUserId,
  isHost,
  isLocked,
  onMuteAll,
  onToggleLock,
  onKickUser,
  onOpenInvite,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 sm:w-96 h-full bg-[#1A1410] border-l border-[#3C230B]/60 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#3C230B]/60 flex items-center justify-between bg-[#140F0C]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="font-editorial text-base font-bold text-[#FFFCF5]">
            Majlis Seekers
          </h3>
          <span className="text-[10px] bg-[#2B1706] text-[#E0C2A6] px-2 py-0.5 rounded-full font-mono">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-[#8E7E73] hover:text-[#FFFCF5] rounded-lg hover:bg-[#2B1706] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Host Moderation Bar */}
      {isHost && (
        <div className="p-3 bg-[#241710] border-b border-[#3C230B]/60 flex items-center justify-between gap-2">
          <button
            onClick={onMuteAll}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FFFCF5] bg-[#3C230B] hover:bg-[#2B1706] rounded-xl border border-[#D4AF37]/20 transition"
          >
            <MicOff className="w-3.5 h-3.5 text-red-400" />
            Mute All
          </button>
          <button
            onClick={onToggleLock}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              isLocked
                ? 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                : 'bg-[#1E1712] text-[#D9D0C3] border-[#3C230B] hover:bg-[#2B1706]'
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Locked
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-[#8E7E73]" /> Lock Room
              </>
            )}
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 border-b border-[#3C230B]/40">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter attendees..."
          className="w-full bg-[#1E1712] border border-[#3C230B] rounded-xl px-3 py-1.5 text-xs text-[#FFFCF5] placeholder-[#8E7E73] focus:outline-none focus:border-[#D4AF37] transition"
        />
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((p) => {
          const isMe = p.id === currentUserId;
          return (
            <div
              key={p.id}
              className="group relative flex items-center justify-between p-2.5 rounded-xl hover:bg-[#241710] transition"
            >
              {/* User Avatar + Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-8 h-8 rounded-xl bg-[#2B1706] border border-[#3C230B] flex items-center justify-center font-editorial font-bold text-sm text-[#E0C2A6] shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                  {p.handRaised && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4AF37] text-[#3C230B] flex items-center justify-center shadow">
                      <Hand className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#FFFCF5] truncate">
                      {p.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-[#8E7E73] font-normal">
                        (You)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {p.isHost && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#D4AF37] bg-[#D4AF37]/15 px-1 py-0.2 rounded border border-[#D4AF37]/30">
                        <Crown className="w-2.5 h-2.5" /> Facilitator
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Icons & Action Menu */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`p-1.5 rounded-lg ${
                    p.isMuted
                      ? 'text-red-400 bg-red-950/50'
                      : 'text-[#E0C2A6] bg-[#2B1706]'
                  }`}
                >
                  {p.isMuted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </div>
                <div
                  className={`p-1.5 rounded-lg ${
                    p.isVideoOff
                      ? 'text-red-400 bg-red-950/50'
                      : 'text-[#E0C2A6] bg-[#2B1706]'
                  }`}
                >
                  {p.isVideoOff ? (
                    <VideoOff className="w-3.5 h-3.5" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Host actions menu */}
                {isHost && !isMe && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenuId(activeMenuId === p.id ? null : p.id)
                      }
                      className="p-1.5 text-[#8E7E73] hover:text-[#FFFCF5] rounded-lg hover:bg-[#2B1706] transition"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {activeMenuId === p.id && (
                      <div className="absolute right-0 top-8 z-40 w-40 bg-[#241710] border border-[#3C230B] rounded-xl shadow-xl py-1 text-xs">
                        <button
                          onClick={() => {
                            onKickUser(p.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-[#2B1706] transition"
                        >
                          <UserMinus className="w-3.5 h-3.5" /> Dismiss from Majlis
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite footer */}
      <div className="p-4 border-t border-[#3C230B]/60 bg-[#140F0C]">
        <button
          onClick={onOpenInvite}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#FFFCF5] bg-[#3C230B] hover:bg-[#2B1706] rounded-xl shadow transition"
        >
          <Users className="w-4 h-4 text-[#E0C2A6]" />
          <span>Invite More Seekers</span>
        </button>
      </div>
    </div>
  );
};
