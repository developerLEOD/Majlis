import React, { useState } from 'react';
import {
  Crown,
  Lock,
  Unlock,
  MicOff,
  Hand,
  MessageSquare,
  Share2,
  Bell,
  Sparkles,
  Users,
  Shield,
  X,
  AlertTriangle,
  Radio,
  Tv,
} from 'lucide-react';

interface FacilitatorHubModalProps {
  isLocked: boolean;
  chatEnabled: boolean;
  screenShareEnabled: boolean;
  participantCount: number;
  spotlightUserId: string | null;
  onToggleLock: () => void;
  onMuteAll: () => void;
  onLowerAllHands: () => void;
  onToggleChatPermission: (enabled: boolean) => void;
  onToggleScreenSharePermission: (enabled: boolean) => void;
  onClearSpotlight: () => void;
  onBroadcastAnnouncement: (text: string) => void;
  onEndMeetingForAll: () => void;
  onClose: () => void;
}

export const FacilitatorHubModal: React.FC<FacilitatorHubModalProps> = ({
  isLocked,
  chatEnabled,
  screenShareEnabled,
  participantCount,
  spotlightUserId,
  onToggleLock,
  onMuteAll,
  onLowerAllHands,
  onToggleChatPermission,
  onToggleScreenSharePermission,
  onClearSpotlight,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#18120E] border border-[#3C230B] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#3C230B]/80 flex items-center justify-between bg-gradient-to-r from-[#241710] to-[#1A130E]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-editorial text-base font-bold text-[#FFFCF5] flex items-center gap-2">
                Facilitator Control Center
              </h3>
              <p className="text-[11px] text-[#A8988B]">
                Moderation & Adab tools for {participantCount} attendee{participantCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E7E73] hover:text-[#FFFCF5] rounded-lg hover:bg-[#2B1706] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-[#FFFCF5]">
          {/* Quick Order Actions */}
          <div>
            <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Quick Actions
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Mute All */}
              <button
                onClick={onMuteAll}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#241710] hover:bg-[#2B1706] border border-[#3C230B] hover:border-[#D4AF37]/40 transition text-left group"
              >
                <div className="p-2 rounded-lg bg-red-950/60 text-red-400 group-hover:scale-105 transition-transform">
                  <MicOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#FFFCF5]">Mute All Seekers</div>
                  <div className="text-[10px] text-[#8E7E73]">Silence all attendee mics</div>
                </div>
              </button>

              {/* Lower All Hands */}
              <button
                onClick={onLowerAllHands}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#241710] hover:bg-[#2B1706] border border-[#3C230B] hover:border-[#D4AF37]/40 transition text-left group"
              >
                <div className="p-2 rounded-lg bg-[#3C230B] text-[#D4AF37] group-hover:scale-105 transition-transform">
                  <Hand className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#FFFCF5]">Lower All Hands</div>
                  <div className="text-[10px] text-[#8E7E73]">Clear raised hands queue</div>
                </div>
              </button>

              {/* Lock / Unlock */}
              <button
                onClick={onToggleLock}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition text-left group ${
                  isLocked
                    ? 'bg-amber-950/40 border-amber-600/50 hover:bg-amber-950/60'
                    : 'bg-[#241710] hover:bg-[#2B1706] border-[#3C230B] hover:border-[#D4AF37]/40'
                }`}
              >
                <div
                  className={`p-2 rounded-lg group-hover:scale-105 transition-transform ${
                    isLocked ? 'bg-amber-900/60 text-amber-300' : 'bg-[#1A1410] text-[#8E7E73]'
                  }`}
                >
                  {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#FFFCF5]">
                    {isLocked ? 'Unlock Majlis' : 'Lock Majlis'}
                  </div>
                  <div className="text-[10px] text-[#8E7E73]">
                    {isLocked ? 'Allow new joiners' : 'Prevent new entries'}
                  </div>
                </div>
              </button>

              {/* Spotlight Reset */}
              <button
                onClick={onClearSpotlight}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#241710] hover:bg-[#2B1706] border border-[#3C230B] hover:border-[#D4AF37]/40 transition text-left group"
              >
                <div className="p-2 rounded-lg bg-[#3C230B] text-[#E0C2A6] group-hover:scale-105 transition-transform">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#FFFCF5]">
                    {spotlightUserId ? 'Clear Spotlight' : 'Stage Layout'}
                  </div>
                  <div className="text-[10px] text-[#8E7E73]">
                    {spotlightUserId ? 'Return to grid view' : 'Balanced grid active'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Attendee Permissions */}
          <div className="border-t border-[#3C230B]/60 pt-4">
            <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Attendee Permissions
            </h4>
            <div className="space-y-2 bg-[#201611] rounded-xl p-3 border border-[#3C230B]/70">
              {/* Chat Permission */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-[#A8988B]" />
                  <div>
                    <div className="text-xs font-medium text-[#FFFCF5]">In-Session Chat</div>
                    <div className="text-[10px] text-[#8E7E73]">Allow seekers to post messages</div>
                  </div>
                </div>
                <button
                  onClick={() => onToggleChatPermission(!chatEnabled)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    chatEnabled ? 'bg-[#D4AF37]' : 'bg-[#3C230B]'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-[#18120E] shadow transform transition-transform ${
                      chatEnabled ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Screen Share Permission */}
              <div className="flex items-center justify-between pt-2 border-t border-[#3C230B]/40">
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-4 h-4 text-[#A8988B]" />
                  <div>
                    <div className="text-xs font-medium text-[#FFFCF5]">Attendee Screen Sharing</div>
                    <div className="text-[10px] text-[#8E7E73]">Allow non-hosts to present screen</div>
                  </div>
                </div>
                <button
                  onClick={() => onToggleScreenSharePermission(!screenShareEnabled)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    screenShareEnabled ? 'bg-[#D4AF37]' : 'bg-[#3C230B]'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-[#18120E] shadow transform transition-transform ${
                      screenShareEnabled ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Broadcast Announcement */}
          <div className="border-t border-[#3C230B]/60 pt-4">
            <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Broadcast Stage Announcement
            </h4>
            <form onSubmit={handleSendAnnouncement} className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="e.g. Resuming after Maghrib prayer / Q&A open..."
                  className="w-full bg-[#201611] border border-[#3C230B] rounded-xl px-3 py-2 text-xs text-[#FFFCF5] placeholder-[#8E7E73] focus:outline-none focus:border-[#D4AF37] pr-20"
                />
                <button
                  type="submit"
                  disabled={!announcementText.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#D4AF37] hover:bg-[#C29D2D] disabled:opacity-40 text-[#241710] font-bold text-[11px] rounded-lg transition"
                >
                  Broadcast
                </button>
              </div>
              {sentSuccess && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  ✓ Announcement broadcast to all attendees
                </p>
              )}
            </form>
          </div>

          {/* End Session Danger Zone */}
          <div className="border-t border-[#3C230B]/60 pt-4">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Conclude Gathering
            </h4>
            {!showEndConfirm ? (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full py-2.5 px-4 bg-red-950/40 hover:bg-red-950/80 border border-red-900/60 hover:border-red-700 text-red-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <span>End Majlis Session for All Attendees</span>
              </button>
            ) : (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl space-y-2.5 text-center">
                <p className="text-xs text-red-200 font-medium">
                  This will disconnect all attendees and remove this room from the live directory.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onEndMeetingForAll();
                      onClose();
                    }}
                    className="flex-1 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg shadow transition"
                  >
                    Yes, End for All
                  </button>
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="px-3 py-1.5 bg-[#241710] text-[#D9D0C3] text-xs rounded-lg hover:bg-[#2B1706] transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3C230B]/80 bg-[#140F0C] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2B1706] hover:bg-[#3C230B] text-[#E0C2A6] text-xs font-semibold rounded-xl border border-[#3C230B] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
