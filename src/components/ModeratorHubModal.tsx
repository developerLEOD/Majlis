import React, { useState } from 'react';
import {
  Crown,
  Lock,
  Unlock,
  MicOff,
  Hand,
  MessageSquare,
  Share2,
  Sparkles,
  Shield,
  X,
  AlertTriangle,
  Radio,
  Tv,
  Volume2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { Participant } from '../types/meeting';
import { IslamicStarRosette } from './common/IslamicStarRosette';

interface ModeratorHubModalProps {
  isLocked: boolean;
  chatEnabled: boolean;
  screenShareEnabled: boolean;
  participants: Participant[];
  spotlightUserId: string | null;
  onToggleLock: () => void;
  onMuteAll: () => void;
  onLowerAllHands: () => void;
  onToggleChatPermission: (enabled: boolean) => void;
  onToggleScreenSharePermission: (enabled: boolean) => void;
  onClearSpotlight: () => void;
  onToggleSpeaker: (userId: string) => void;
  onBroadcastAnnouncement: (text: string) => void;
  onEndMeetingForAll: () => void;
  onClose: () => void;
}

export const ModeratorHubModal: React.FC<ModeratorHubModalProps> = ({
  isLocked,
  chatEnabled,
  screenShareEnabled,
  participants,
  spotlightUserId,
  onToggleLock,
  onMuteAll,
  onLowerAllHands,
  onToggleChatPermission,
  onToggleScreenSharePermission,
  onClearSpotlight,
  onToggleSpeaker,
  onBroadcastAnnouncement,
  onEndMeetingForAll,
  onClose,
}) => {
  const [announcementText, setAnnouncementText] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    onBroadcastAnnouncement(announcementText.trim());
    setAnnouncementText('');
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 2500);
  };

  const speakers = participants.filter((p) => p.isSpeaker);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="w-full max-w-lg bg-[#FFFCF5] border border-[#302116] rounded-sm overflow-hidden flex flex-col max-h-[90vh] text-[#1C1917] shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F5F2EB]">
          <div className="flex items-center gap-3">
            <IslamicStarRosette size={26} variant="full" />
            <div>
              <h2 className="text-base font-bold text-[#1C1917] leading-tight flex items-center gap-2">
                <span>Moderator Control Center</span>
                <span className="px-1.5 py-0.2 bg-[#E9A83A] text-[#1E140C] text-[9px] font-bold rounded-sm uppercase tracking-wider">
                  Moderator
                </span>
              </h2>
              <p className="text-[11px] text-[#8E7E73] mt-0.5">
                Manage speakers, permissions, and stage for {participants.length} attendee{participants.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E7E73] hover:text-[#1C1917] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* SPEAKER MANAGEMENT SECTION */}
          <div className="bg-[#FAF8F5] p-3.5 rounded-sm border border-[#E6DFD5] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E9A83A]" /> Assign Stage Speakers ({speakers.length})
              </h3>
              <span className="text-[10px] text-[#075E4A] font-semibold bg-[#075E4A]/10 px-2 py-0.5 rounded-sm">
                Star Medallion Portals
              </span>
            </div>

            <p className="text-[11px] text-[#68594E]">
              Assigned speakers appear in the 8-sided Star Medallion portals on the left side of the sanctuary.
            </p>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-sm bg-[#FFFCF5] border border-[#E6DFD5] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1C1917]">{p.name}</span>
                    {p.isHost && (
                      <span className="px-1.5 py-0.2 bg-[#E9A83A] text-[#1E140C] text-[9px] font-bold rounded-sm">
                        Mod
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleSpeaker(p.id)}
                    className={`px-3 py-1 rounded-sm text-[11px] font-bold transition-colors flex items-center gap-1 ${
                      p.isSpeaker
                        ? 'bg-[#075E4A] text-[#FFFCF5] border border-[#19A6A0]/40'
                        : 'bg-[#EFECE4] text-[#302116] hover:bg-[#E2DDD3] border border-[#D9D0C3]'
                    }`}
                  >
                    {p.isSpeaker ? (
                      <>
                        <UserCheck className="w-3 h-3 text-[#E9A83A]" /> Active Speaker
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3 text-[#075E4A]" /> Assign Speaker
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#E9A83A]" /> Moderator Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Mute All */}
              <button
                onClick={onMuteAll}
                className="flex items-center gap-2.5 p-3 rounded-sm bg-[#F5F2EB] hover:bg-[#EAE4DC] border border-[#E0D7CB] transition-colors text-left shadow-xs"
              >
                <div className="p-1.5 rounded-sm bg-red-100 text-[#A83245]">
                  <MicOff className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1C1917]">Mute All Mics</div>
                  <div className="text-[10px] text-[#7A6C62]">Silence attendee audio</div>
                </div>
              </button>

              {/* Lower All Hands */}
              <button
                onClick={onLowerAllHands}
                className="flex items-center gap-2.5 p-3 rounded-sm bg-[#F5F2EB] hover:bg-[#EAE4DC] border border-[#E0D7CB] transition-colors text-left shadow-xs"
              >
                <div className="p-1.5 rounded-sm bg-amber-100 text-[#8F6614]">
                  <Hand className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1C1917]">Lower All Hands</div>
                  <div className="text-[10px] text-[#7A6C62]">Clear raised queue</div>
                </div>
              </button>

              {/* Lock / Unlock */}
              <button
                onClick={onToggleLock}
                className={`flex items-center gap-2.5 p-3 rounded-sm border transition-colors text-left shadow-xs ${
                  isLocked
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-[#F5F2EB] hover:bg-[#EAE4DC] border-[#E0D7CB]'
                }`}
              >
                <div
                  className={`p-1.5 rounded-sm ${
                    isLocked ? 'bg-amber-200 text-amber-900' : 'bg-[#EAE4DC] text-[#7A6C62]'
                  }`}
                >
                  {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1C1917]">
                    {isLocked ? 'Unlock Sanctuary' : 'Lock Sanctuary'}
                  </div>
                  <div className="text-[10px] text-[#7A6C62]">
                    {isLocked ? 'Allow joiners' : 'Prevent new entries'}
                  </div>
                </div>
              </button>

              {/* Spotlight Reset */}
              <button
                onClick={onClearSpotlight}
                className="flex items-center gap-2.5 p-3 rounded-sm bg-[#F5F2EB] hover:bg-[#EAE4DC] border border-[#E0D7CB] transition-colors text-left shadow-xs"
              >
                <div className="p-1.5 rounded-sm bg-[#DDE6DC] text-[#075E4A]">
                  <Tv className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1C1917]">
                    {spotlightUserId ? 'Clear Spotlight' : 'Honeycomb Grid'}
                  </div>
                  <div className="text-[10px] text-[#7A6C62]">
                    {spotlightUserId ? 'Return to grid' : 'Honeycomb assembly active'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Attendee Permissions */}
          <div className="border-t border-[#EAE4DC] pt-4">
            <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#8E7E73]" /> Participant Permissions
            </h3>
            <div className="space-y-2.5 bg-[#F5F2EB] rounded-sm p-3.5 border border-[#E0D7CB]">
              {/* Chat Permission */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#8E7E73]" />
                  <div>
                    <div className="text-xs font-semibold text-[#1C1917]">In-Session Chat</div>
                    <div className="text-[10px] text-[#7A6C62]">Allow seekers to post thoughts</div>
                  </div>
                </div>
                <button
                  onClick={() => onToggleChatPermission(!chatEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    chatEnabled ? 'bg-[#075E4A]' : 'bg-[#D9D0C3]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      chatEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Screen Share Permission */}
              <div className="flex items-center justify-between pt-2.5 border-t border-[#EAE4DC]">
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-3.5 h-3.5 text-[#8E7E73]" />
                  <div>
                    <div className="text-xs font-semibold text-[#1C1917]">Screen Sharing</div>
                    <div className="text-[10px] text-[#7A6C62]">Allow non-moderators to present screen</div>
                  </div>
                </div>
                <button
                  onClick={() => onToggleScreenSharePermission(!screenShareEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    screenShareEnabled ? 'bg-[#075E4A]' : 'bg-[#D9D0C3]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      screenShareEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Broadcast Announcement */}
          <div className="border-t border-[#EAE4DC] pt-4">
            <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#E9A83A]" /> Broadcast Stage Announcement
            </h3>
            <form onSubmit={handleSendAnnouncement} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="e.g. Q&A open / Resuming short break..."
                  className="flex-1 bg-[#FAF8F5] border border-[#D5CABB] rounded-sm px-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#075E4A]"
                />
                <button
                  type="submit"
                  disabled={!announcementText.trim()}
                  className="px-4 py-2 bg-[#075E4A] hover:bg-[#05493A] disabled:opacity-40 text-white font-semibold text-xs rounded-sm transition-colors shrink-0 shadow-xs"
                >
                  Broadcast
                </button>
              </div>
              {sentSuccess && (
                <p className="text-[11px] text-[#19A6A0] font-semibold">
                  ✓ Announcement broadcast to all attendees on stage
                </p>
              )}
            </form>
          </div>

          {/* End Session */}
          <div className="border-t border-[#EAE4DC] pt-4">
            <h3 className="text-xs font-bold text-[#A83245] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Conclude Gathering
            </h3>
            {!showEndConfirm ? (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-[#A83245] rounded-sm text-xs font-semibold transition-colors"
              >
                End Majlis Session for All
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-sm space-y-2.5 text-center">
                <p className="text-xs text-red-900 font-semibold">
                  Disconnect all seekers and close the live room?
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      onEndMeetingForAll();
                      onClose();
                    }}
                    className="py-1.5 px-4 bg-[#A83245] hover:bg-[#8B2334] text-white text-xs font-bold rounded-sm transition-colors shadow-xs"
                  >
                    Yes, End for All
                  </button>
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="py-1.5 px-4 bg-[#EAE4DC] text-[#1C1917] border border-[#D5CABB] text-xs font-semibold rounded-sm hover:bg-[#DFD8CE] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EAE4DC] bg-[#F5F2EB] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#075E4A] hover:bg-[#05493A] text-white text-xs font-bold rounded-sm transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
