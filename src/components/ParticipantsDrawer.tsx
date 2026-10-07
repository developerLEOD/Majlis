import React, { useState } from 'react';
import {
  Camera,
  Crown,
  Hand,
  Lock,
  Mic,
  MicOff,
  MoreVertical,
  Unlock,
  UserMinus,
  Users,
  VideoOff,
  X,
  Tv,
  ArrowRightLeft,
  Sliders,
  Sparkles,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { Participant } from '../types/meeting';
import { IslamicStarRosette } from './common/IslamicStarRosette';

interface ParticipantsDrawerProps {
  participants: Participant[];
  currentUserId: string;
  isHost: boolean;
  canModerate?: boolean;
  isPrimaryHost?: boolean;
  isLocked: boolean;
  spotlightUserId?: string | null;
  onMuteAll: () => void;
  onStopAllVideo?: () => void;
  onToggleLock: () => void;
  onMuteUser?: (userId: string) => void;
  onUnmuteUser?: (userId: string) => void;
  onStopVideoUser?: (userId: string) => void;
  onStartVideoUser?: (userId: string) => void;
  onLowerHand?: (userId: string) => void;
  onSpotlightUser?: (userId: string | null) => void;
  onToggleSpeaker?: (userId: string) => void;
  onToggleCoModerator?: (userId: string) => void;
  onTransferHost?: (userId: string) => void;
  onKickUser: (userId: string) => void;
  onOpenFacilitatorHub?: () => void;
  onOpenInvite: () => void;
  onClose: () => void;
}

export const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  participants,
  currentUserId,
  isHost,
  canModerate = isHost,
  isPrimaryHost = isHost,
  isLocked,
  spotlightUserId,
  onMuteAll,
  onStopAllVideo,
  onToggleLock,
  onMuteUser,
  onUnmuteUser,
  onStopVideoUser,
  onStartVideoUser,
  onLowerHand,
  onSpotlightUser,
  onToggleSpeaker,
  onToggleCoModerator,
  onTransferHost,
  onKickUser,
  onOpenFacilitatorHub,
  onOpenInvite,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 sm:w-88 h-full bg-[#160E09] border-l border-[#2E1E14] flex flex-col z-30 select-none shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-[#2E1E14] flex items-center justify-between bg-[#110A05]">
        <div className="flex items-center gap-2.5">
          <IslamicStarRosette size={20} variant="full" />
          <h3 className="text-xs font-bold text-[#FFFCF5]">
            Majlis Seekers & Speakers
          </h3>
          <span className="text-[10px] bg-[#22160E] text-[#E9A83A] px-1.5 py-0.5 rounded-sm font-mono border border-[#3A2619]">
            {participants.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canModerate && onOpenFacilitatorHub && (
            <button
              onClick={onOpenFacilitatorHub}
              className="p-1 px-2 text-[#E9A83A] bg-[#075E4A] hover:bg-[#05493A] border border-[#19A6A0]/50 rounded-sm transition-colors text-xs font-semibold flex items-center gap-1 shadow-xs"
              title="Moderator Control Center"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[10px]">Mod Hub</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-[#8A7A6D] hover:text-[#FFFCF5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Host / Moderator Quick Bar */}
      {canModerate && (
        <div className="p-3 bg-[#1F140D] border-b border-[#2E1E14] flex items-center justify-between gap-2 text-xs">
          <button
            onClick={onMuteAll}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 font-semibold text-white bg-[#A83245] hover:bg-[#8B2334] rounded-sm transition-colors border border-[#C44056] shadow-xs"
            title="Mute all attendee microphones"
          >
            <MicOff className="w-3.5 h-3.5" />
            <span>Mute All</span>
          </button>
          {onStopAllVideo && (
            <button
              onClick={onStopAllVideo}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 font-semibold text-white bg-[#A83245]/85 hover:bg-[#8B2334] rounded-sm transition-colors border border-[#C44056]/80 shadow-xs"
              title="Turn off all attendee cameras"
            >
              <VideoOff className="w-3.5 h-3.5" />
              <span>Cameras Off</span>
            </button>
          )}
          <button
            onClick={onToggleLock}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 font-semibold rounded-sm border transition-colors ${
              isLocked
                ? 'bg-[#A83245]/30 text-[#E9A83A] border-[#A83245]/60'
                : 'bg-[#160E09] text-[#FFFCF5] border-[#2E1E14] hover:bg-[#25170F]'
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-[#E9A83A]" /> Locked
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-[#8A7A6D]" /> Lock
              </>
            )}
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 border-b border-[#2E1E14]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter attendees..."
          className="w-full bg-[#1E130B] border border-[#362316] rounded-sm px-3.5 py-2 text-xs text-[#FFFCF5] placeholder-[#8A7A6D] focus:outline-none focus:border-[#075E4A]"
        />
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        {filtered.map((p) => {
          const isMe = p.id === currentUserId;
          const isSpotlighted = spotlightUserId === p.id;

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between p-2.5 rounded-sm transition-colors ${
                p.isSpeaker
                  ? 'bg-[#281A11] border border-[#E9A83A]/60'
                  : isSpotlighted
                  ? 'bg-[#075E4A]/40 border border-[#E9A83A]'
                  : 'hover:bg-[#1F140D]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#075E4A] border border-[#19A6A0]/50 flex items-center justify-center font-bold text-xs text-[#FFFCF5] shrink-0 relative">
                  {p.name.charAt(0).toUpperCase()}
                  {p.handRaised && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#E9A83A] text-[#1E140C] flex items-center justify-center border border-[#160E09]">
                      <Hand className="w-2 h-2" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#FFFCF5] truncate">
                      {p.name}
                    </span>
                    {isMe && <span className="text-[10px] text-[#8A7A6D]">(You)</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {p.isHost && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-[#1E140C] bg-[#E9A83A] px-1 py-0.2 rounded-sm">
                        <Crown className="w-2.5 h-2.5" /> Moderator
                      </span>
                    )}
                    {p.isCoModerator && !p.isHost && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-[#1E140C] bg-[#E9A83A]/90 px-1 py-0.2 rounded-sm border border-[#E9A83A]">
                        <Shield className="w-2.5 h-2.5 text-[#075E4A]" /> Co-Moderator
                      </span>
                    )}
                    {p.isSpeaker && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-[#FFFCF5] bg-[#075E4A] px-1 py-0.2 rounded-sm border border-[#19A6A0]/50">
                        <Sparkles className="w-2.5 h-2.5 text-[#E9A83A]" /> Speaker
                      </span>
                    )}
                    {isSpotlighted && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#19A6A0] bg-[#19A6A0]/20 px-1 py-0.2 rounded-sm border border-[#19A6A0]/40">
                        <Tv className="w-2.5 h-2.5" /> Spotlight
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Icons & Action Menu */}
              <div className="flex items-center gap-1 shrink-0">
                <div
                  className={`p-1 rounded-sm ${
                    p.isMuted ? 'text-[#A83245] bg-[#A83245]/20' : 'text-[#19A6A0]'
                  }`}
                >
                  {p.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`p-1 rounded-sm ${
                    p.isVideoOff ? 'text-[#A83245] bg-[#A83245]/20' : 'text-[#8A7A6D]'
                  }`}
                >
                  {p.isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                </div>

                {canModerate && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenuId(activeMenuId === p.id ? null : p.id)
                      }
                      className="p-1 text-[#8A7A6D] hover:text-[#FFFCF5] rounded-sm transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {activeMenuId === p.id && (
                      <div className="absolute right-0 top-7 z-50 w-52 bg-[#1F140D] border border-[#3A2619] rounded-sm py-1 text-xs text-[#FFFCF5] shadow-2xl">
                        {onToggleSpeaker && (
                          <button
                            onClick={() => {
                              onToggleSpeaker(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#E9A83A]"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#E9A83A]" />
                            {p.isSpeaker ? 'Remove Speaker Role' : 'Assign as Speaker'}
                          </button>
                        )}

                        {/* Co-Moderator Assignment - Only primary host can toggle */}
                        {isPrimaryHost && onToggleCoModerator && !isMe && !p.isHost && (
                          <button
                            onClick={() => {
                              onToggleCoModerator(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#19A6A0]"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#19A6A0]" />
                            {p.isCoModerator ? 'Remove Co-Moderator Role' : 'Assign as Co-Moderator'}
                          </button>
                        )}

                        {!p.isMuted && onMuteUser && (
                          <button
                            onClick={() => {
                              onMuteUser(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#FFFCF5]"
                          >
                            <MicOff className="w-3.5 h-3.5 text-[#A83245]" /> Mute Microphone
                          </button>
                        )}

                        {p.isMuted && onUnmuteUser && (
                          <button
                            onClick={() => {
                              onUnmuteUser(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#19A6A0]"
                          >
                            <Mic className="w-3.5 h-3.5 text-[#19A6A0]" /> Unmute Microphone
                          </button>
                        )}

                        {!p.isVideoOff && onStopVideoUser && !isMe && (
                          <button
                            onClick={() => {
                              onStopVideoUser(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#FFFCF5]"
                          >
                            <VideoOff className="w-3.5 h-3.5 text-[#A83245]" /> Turn Off Video
                          </button>
                        )}

                        {p.isVideoOff && onStartVideoUser && !isMe && (
                          <button
                            onClick={() => {
                              onStartVideoUser(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#19A6A0]"
                          >
                            <Camera className="w-3.5 h-3.5 text-[#19A6A0]" /> Turn On Video
                          </button>
                        )}

                        {p.handRaised && onLowerHand && (
                          <button
                            onClick={() => {
                              onLowerHand(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#E9A83A]"
                          >
                            <Hand className="w-3.5 h-3.5" /> Lower Hand
                          </button>
                        )}

                        {onSpotlightUser && (
                          <button
                            onClick={() => {
                              onSpotlightUser(isSpotlighted ? null : p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#FFFCF5]"
                          >
                            <Tv className="w-3.5 h-3.5 text-[#19A6A0]" />
                            {isSpotlighted ? 'Remove Spotlight' : 'Spotlight on Stage'}
                          </button>
                        )}

                        {isPrimaryHost && onTransferHost && !isMe && (
                          <button
                            onClick={() => {
                              if (confirm(`Transfer Moderator role to ${p.name}?`)) {
                                onTransferHost(p.id);
                              }
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2E1E14] text-[#E9A83A] border-t border-[#3A2619]"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer Moderator Role
                          </button>
                        )}

                        {!isMe && !p.isHost && (
                          <button
                            onClick={() => {
                              onKickUser(p.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#A83245] hover:bg-[#A83245]/20 border-t border-[#3A2619]"
                          >
                            <UserMinus className="w-3.5 h-3.5" /> Dismiss
                          </button>
                        )}
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
      <div className="p-3.5 border-t border-[#2E1E14] bg-[#110A05]">
        <button
          onClick={onOpenInvite}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#FFFCF5] bg-[#075E4A] hover:bg-[#05493A] rounded-sm transition-colors border border-[#19A6A0]/50 shadow-xs"
        >
          <Users className="w-4 h-4 text-[#E9A83A]" />
          <span>Invite Seekers</span>
        </button>
      </div>
    </div>
  );
};
