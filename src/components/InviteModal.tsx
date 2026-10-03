import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link, Share2, Users, X } from 'lucide-react';
import {
  buildMeetingInviteUrl,
  copyTextToClipboard,
  fetchAppConfig,
  getCachedPublicAppUrl,
} from '../utils/urlHelper';

interface InviteModalProps {
  roomId: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ roomId, onClose }) => {
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

  const inviteUrl = buildMeetingInviteUrl(roomId, appUrl);

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
          title: 'InfinityMeet Video Meeting',
          text: `Join my InfinityMeet call: ${roomId}`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white">Invite to Meeting</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Direct Meeting URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-blue-400" />
                Direct Meeting Link
              </label>
              {canShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                >
                  <Share2 className="w-3 h-3" /> Share...
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                onClick={handleCopyLink}
                className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono truncate select-all cursor-pointer transition"
                title="Click to copy full invite link"
              >
                {inviteUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition shrink-0 shadow-md ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 active:scale-98 text-white'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Room Code */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Room Code Only
            </label>
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="font-mono text-lg font-bold tracking-widest text-blue-400 select-all">
                {roomId}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied Code' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Quick info note */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300/90 leading-relaxed">
            Guests simply click the link or enter the room code to join right in their browser. No sign-up or download needed.
          </div>
        </div>
      </div>
    </div>
  );
};
