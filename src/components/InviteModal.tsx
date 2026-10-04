import React, { useEffect, useState } from 'react';
import { Check, Copy, Link, Share2, X } from 'lucide-react';
import {
  buildMeetingInviteUrl,
  copyTextToClipboard,
  fetchAppConfig,
  getCachedPublicAppUrl,
} from '../utils/urlHelper';
import { IslamicStarRosette } from './common/IslamicStarRosette';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#FAF8F5] border border-[#302116] rounded-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#EAE4DC]">
          <div className="flex items-center gap-3">
            <IslamicStarRosette size={26} variant="full" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#8A7A6D]">
                THE WISDOM LOUNGE
              </div>
              <h2 className="text-base font-bold text-[#1C1917]">
                Invite to Majlis
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8A7A6D] hover:text-[#1C1917] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Direct Link */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-[#8A7A6D]" />
                Direct Majlis Link
              </label>
              {canShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-1 text-[#0D3B36] hover:underline font-semibold transition-colors"
                >
                  <Share2 className="w-3 h-3" /> Share...
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                onClick={handleCopyLink}
                className="flex-1 bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm px-3 py-2 text-[#1C1917] font-mono truncate select-all cursor-pointer"
                title="Click to copy full invite link"
              >
                {inviteUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold rounded-sm transition-colors shrink-0 shadow-xs ${
                  copiedLink
                    ? 'bg-[#15803D] text-white'
                    : 'bg-[#0D3B36] hover:bg-[#072B26] text-white'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Majlis Code */}
          <div>
            <label className="font-semibold text-[#1C1917] block mb-1.5">
              Majlis Code Only
            </label>
            <div className="flex items-center justify-between bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm p-3">
              <span className="font-mono text-sm font-bold tracking-wider text-[#1C1917] select-all">
                #{roomId}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C1917] bg-[#EAE4DC] border border-[#D5CABB] rounded-sm hover:bg-[#DFD8CE] transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#15803D]" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Quick info note */}
          <div className="p-3 bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm text-[11px] text-[#6B5E55] leading-relaxed">
            Invitees can open the direct link or enter the room code to join the live circle instantly.
          </div>
        </div>
      </div>
    </div>
  );
};
