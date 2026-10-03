import React, { useEffect, useState } from 'react';
import { Check, Copy, Link, Share2, Users, X } from 'lucide-react';
import {
  buildMeetingInviteUrl,
  copyTextToClipboard,
  fetchAppConfig,
  getCachedPublicAppUrl,
} from '../utils/urlHelper';

interface InviteModalProps {
  roomId: string;
  title?: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ roomId, title, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [appUrl, setAppUrl] = useState<string>(getCachedPublicAppUrl());
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const url = await fetchAppConfig();
      if (url) setAppUrl(url);
    }
    loadConfig();

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanShare(true);
    }
  }, []);

  const inviteUrl = buildMeetingInviteUrl(roomId, title, appUrl);

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(inviteUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    const success = await copyTextToClipboard(roomId);
    if (success) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title ? `${title} — The Wisdom Lounge` : 'Majlis — The Wisdom Lounge',
          text: `Join the live Majlis (${title || roomId}) on The Wisdom Lounge`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EFECE4] border border-[#D9D0C3] flex items-center justify-center text-[#3C230B]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#8E7E73] block leading-none">
                The Wisdom Lounge
              </span>
              <h3 className="text-base font-bold text-[#3C230B] leading-tight">
                Invite to Majlis
              </h3>
              {title && (
                <p className="text-xs text-[#68594E] font-medium truncate max-w-xs mt-0.5">{title}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E7E73] hover:text-[#3C230B] rounded-lg hover:bg-[#EFECE4] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Direct Majlis URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#3C230B] flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-[#8E7E73]" />
                Direct Majlis Link
              </label>
              {canShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-1 text-[11px] text-[#3C230B] hover:underline font-medium transition"
                >
                  <Share2 className="w-3 h-3" /> Share...
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                onClick={handleCopyLink}
                className="flex-1 bg-white border border-[#D9D0C3] hover:border-[#3C230B] rounded-xl px-3 py-2 text-xs text-[#241710] font-mono truncate select-all cursor-pointer transition"
                title="Click to copy full invite link"
              >
                {inviteUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-700 text-white'
                    : 'bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5]'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Majlis ID */}
          <div>
            <label className="text-xs font-semibold text-[#3C230B] block mb-1.5">
              Majlis ID Only
            </label>
            <div className="flex items-center justify-between bg-[#F5F2EB] border border-[#E6DFD5] rounded-xl p-3">
              <span className="font-mono text-base font-bold tracking-widest text-[#3C230B] select-all">
                {roomId}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#3C230B] hover:bg-[#E6DFD5] bg-[#EFECE4] rounded-lg transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </div>

          {/* Quick info note */}
          <div className="p-3 bg-[#EFECE4]/80 border border-[#D9D0C3] rounded-xl text-xs text-[#68594E] leading-relaxed">
            Participants click the link or enter the Majlis ID to join directly in their browser with audio, video, and screen sharing.
          </div>
        </div>
      </div>
    </div>
  );
};
