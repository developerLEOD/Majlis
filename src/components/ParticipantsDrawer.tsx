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
    <div className="w-80 sm:w-96 h-full bg-slate-900 border-l border-slate-800 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Participants</h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Host Quick Controls Bar */}
      {isHost && (
        <div className="p-3 bg-slate-850/60 border-b border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onMuteAll}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-98 rounded-lg border border-slate-700/60 transition"
          >
            <MicOff className="w-3.5 h-3.5 text-red-400" />
            Mute All
          </button>
          <button
            onClick={onToggleLock}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              isLocked
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:bg-slate-700'
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Locked
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-slate-400" /> Lock Room
              </>
            )}
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 border-b border-slate-800">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((p) => {
          const isMe = p.id === currentUserId;
          return (
            <div
              key={p.id}
              className="group relative flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 transition"
            >
              {/* User Avatar + Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-inner">
                  {p.name.charAt(0).toUpperCase()}
                  {p.handRaised && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow">
                      <Hand className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {p.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        (You)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {p.isHost && (
                      <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                        <Crown className="w-2.5 h-2.5" /> Host
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
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-slate-400 bg-slate-800'
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
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-slate-400 bg-slate-800'
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
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {activeMenuId === p.id && (
                      <div className="absolute right-0 top-8 z-40 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 text-xs">
                        <button
                          onClick={() => {
                            onKickUser(p.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-slate-700/80 transition"
                        >
                          <UserMinus className="w-3.5 h-3.5" /> Remove User
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
      <div className="p-4 border-t border-slate-800 bg-slate-900/90">
        <button
          onClick={onOpenInvite}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow transition"
        >
          <Users className="w-4 h-4" />
          Invite More People
        </button>
      </div>
    </div>
  );
};
