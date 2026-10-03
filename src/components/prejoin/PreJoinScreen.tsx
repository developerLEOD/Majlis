import React, { useEffect, useRef, useState } from 'react';
import { Camera, Crown, Key, Lock, Mic, MicOff, Shield, Video, VideoOff } from 'lucide-react';
import { createAudioMeter, getLocalUserMedia } from '../../utils/media';
import { useAuth } from '../../context/AuthContext';

interface PreJoinScreenProps {
  roomId: string;
  sessionTitle?: string;
  isHostDefault?: boolean;
  defaultUserName: string;
  onEnterMeeting: (params: {
    roomId: string;
    userName: string;
    isHost: boolean;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
    title?: string;
  }) => void;
  onCancel: () => void;
  onOpenAuthModal?: () => void;
}

export const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  roomId,
  sessionTitle,
  isHostDefault = false,
  defaultUserName,
  onEnterMeeting,
  onCancel,
  onOpenAuthModal,
}) => {
  const { user, isFacilitator } = useAuth();
  const [userName, setUserName] = useState(defaultUserName || user?.displayName || '');
  const [displayTitle, setDisplayTitle] = useState(sessionTitle || `Majlis (${roomId})`);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const [isHost, setIsHost] = useState(isHostDefault && isFacilitator);
  const [showHostNotice, setShowHostNotice] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    if (roomId) {
      fetch(`/api/room/${roomId}`)
        .then((res) => res.json())
        .then((data) => {
          if (active && data.exists && data.title) {
            setDisplayTitle(data.title);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [roomId]);

  useEffect(() => {
    let active = true;

    async function initMedia() {
      try {
        const { stream: localStream } = await getLocalUserMedia(
          isCameraOn,
          isMicOn,
          userName || 'You'
        );
        if (active) {
          setStream(localStream);
          if (videoRef.current) {
            videoRef.current.srcObject = localStream;
          }
        }
      } catch (e) {
        console.warn('Pre-join media init error:', e);
      }
    }

    initMedia();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = isCameraOn));
      stream.getAudioTracks().forEach((track) => (track.enabled = isMicOn));
    }
  }, [isCameraOn, isMicOn, stream]);

  useEffect(() => {
    if (!stream || !isMicOn) {
      setMicVolume(0);
      return;
    }
    const cleanup = createAudioMeter(stream, (lvl) => setMicVolume(lvl));
    return cleanup;
  }, [stream, isMicOn]);

  const handleToggleHostMode = () => {
    if (!isFacilitator) {
      setShowHostNotice(true);
      setIsHost(false);
    } else {
      setIsHost(!isHost);
      setShowHostNotice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = userName.trim() || (isHost ? 'Facilitator' : 'Seeker');
    localStorage.setItem('infinitymeet_username', finalName);

    onEnterMeeting({
      roomId: roomId.trim().toLowerCase(),
      userName: finalName,
      isHost: isHost && isFacilitator,
      stream,
      isMuted: !isMicOn,
      isVideoOff: !isCameraOn,
      title: displayTitle,
    });
  };

  const handleCancel = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    onCancel();
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#241710] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-md bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
            The Wisdom Lounge
          </span>
          <h2 className="text-2xl font-bold text-[#3C230B] mt-0.5">
            Join Majlis
          </h2>
          {displayTitle && (
            <p className="text-xs text-[#68594E] mt-1 font-medium">{displayTitle}</p>
          )}
          <p className="text-[11px] text-[#8E7E73] font-mono mt-0.5">Majlis ID: {roomId}</p>
        </div>

        {/* Camera Preview */}
        <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-[#D9D0C3] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] ${
              !isCameraOn ? 'opacity-0' : 'opacity-100'
            }`}
          />
          {!isCameraOn && (
            <span className="text-xs text-[#8E7E73]">Camera Off</span>
          )}

          {/* Mic Meter */}
          <div className="absolute bottom-2.5 left-2.5 bg-black/70 backdrop-blur px-2 py-1 rounded text-white flex items-center gap-2 text-xs">
            {isMicOn ? (
              <Mic className="w-3 h-3 text-emerald-400" />
            ) : (
              <MicOff className="w-3 h-3 text-red-400" />
            )}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Audio / Video Toggles */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsMicOn(!isMicOn)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isMicOn
                ? 'bg-[#EFECE4] border-[#D9D0C3] text-[#3C230B]'
                : 'bg-red-100 border-red-200 text-red-700'
            }`}
          >
            {isMicOn ? 'Mic Active' : 'Mic Muted'}
          </button>
          <button
            type="button"
            onClick={() => setIsCameraOn(!isCameraOn)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isCameraOn
                ? 'bg-[#EFECE4] border-[#D9D0C3] text-[#3C230B]'
                : 'bg-red-100 border-red-200 text-red-700'
            }`}
          >
            {isCameraOn ? 'Camera Active' : 'Camera Off'}
          </button>
        </div>

        {/* Host Mode Role Toggle */}
        <div className="p-3 bg-[#F5F2EB] border border-[#E6DFD5] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Crown className={`w-3.5 h-3.5 ${isHost ? 'text-[#D4AF37]' : 'text-[#8E7E73]'}`} />
              <span className="font-semibold text-[#3C230B]">Enter as Facilitator</span>
            </div>
            <button
              type="button"
              onClick={handleToggleHostMode}
              className={`w-9 h-5 rounded-full relative flex items-center transition-colors px-0.5 ${
                isHost ? 'bg-[#3C230B]' : 'bg-[#D9D0C3]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  isHost ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {showHostNotice && !isFacilitator && (
            <div className="p-2.5 bg-[#EFECE4] border border-[#D9D0C3] rounded-lg text-[11px] text-[#3C230B] space-y-1.5">
              <p>
                Facilitator role is enabled on recognized moderator accounts.
              </p>
              {onOpenAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="text-xs font-bold text-[#3C230B] underline flex items-center gap-1"
                >
                  <Key className="w-3 h-3 text-[#D4AF37]" /> Sign in with Moderator Account
                </button>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1 border-t border-[#E6DFD5]">
          <div>
            <label className="text-xs font-semibold text-[#3C230B] block mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Display Name..."
              className="w-full bg-white border border-[#D9D0C3] rounded-xl px-3.5 py-2 text-xs text-[#241710] focus:outline-none focus:border-[#3C230B]"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleCancel}
              className="text-[#8E7E73] hover:text-[#3C230B] font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] font-semibold text-xs rounded-xl shadow-xs transition"
            >
              Join Majlis
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
