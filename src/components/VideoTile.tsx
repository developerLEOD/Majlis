import React, { useEffect, useRef, useState } from 'react';
import { Crown, Hand, Maximize2, Mic, MicOff, Minimize2, VideoOff } from 'lucide-react';
import { Participant } from '../types/meeting';
import { createAudioMeter } from '../utils/media';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  mirror?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  videoRefCallback?: (element: HTMLVideoElement | null) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal,
  mirror = false,
  isPinned = false,
  onTogglePin,
  videoRefCallback,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(true);

  // Bind video stream
  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      if (videoRefCallback) {
        videoRefCallback(videoRef.current);
      }
    }

    // Remote audio playback
    if (!isLocal && audioRef.current && participant.stream) {
      audioRef.current.srcObject = participant.stream;
      audioRef.current.play().catch(() => {});
    }

    const checkTracks = () => {
      if (!participant.stream) {
        setHasVideoTrack(false);
        return;
      }
      const vTracks = participant.stream.getVideoTracks();
      setHasVideoTrack(vTracks.length > 0 && vTracks.some((t) => t.enabled));
    };

    checkTracks();
  }, [participant.stream, isLocal, videoRefCallback, participant.isVideoOff]);

  // Audio speaking detection
  useEffect(() => {
    if (!participant.stream || participant.isMuted) {
      setIsSpeaking(false);
      return;
    }

    const cleanup = createAudioMeter(participant.stream, (volume) => {
      // If voice volume above threshold, mark as speaking
      setIsSpeaking(volume > 18);
    });

    return cleanup;
  }, [participant.stream, participant.isMuted]);

  const initials = participant.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  return (
    <div
      className={`relative w-full h-full bg-[#18120E] rounded-2xl overflow-hidden border transition-colors duration-200 select-none group flex items-center justify-center ${
        isSpeaking
          ? 'border-[#D4AF37] shadow-lg shadow-[#D4AF37]/15 ring-2 ring-[#D4AF37]/40'
          : 'border-[#3C230B]/40 hover:border-[#3C230B]/70'
      }`}
    >
      {/* Remote audio player */}
      {!isLocal && (
        <audio
          ref={(el) => {
            audioRef.current = el;
            if (el && participant.stream && el.srcObject !== participant.stream) {
              el.srcObject = participant.stream;
              el.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
        />
      )}

      {/* Video Element */}
      <video
        ref={(el) => {
          videoRef.current = el;
          if (videoRefCallback) videoRefCallback(el);
          if (el && participant.stream && el.srcObject !== participant.stream) {
            el.srcObject = participant.stream;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local video element to avoid feedback loop
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          participant.isVideoOff || !hasVideoTrack ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${mirror && isLocal ? 'scale-x-[-1]' : ''}`}
      />

      {/* Avatar Fallback when Camera is Off */}
      {(participant.isVideoOff || !hasVideoTrack) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1410]">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-editorial font-bold shadow-md transition-transform ${
                isSpeaking
                  ? 'bg-[#3C230B] text-[#D4AF37] ring-3 ring-[#D4AF37]/50 scale-105'
                  : 'bg-[#2B1706] text-[#E0C2A6] border border-[#3C230B]'
              }`}
            >
              {initials}
            </div>
            {isSpeaking && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#D4AF37] flex items-center justify-center text-[#3C230B] shadow-md animate-pulse">
                <Mic className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          <span className="text-xs font-medium text-[#E0C2A6] mt-3 truncate max-w-[80%]">
            {participant.name}
          </span>
          <span className="text-[11px] text-[#8E7E73] flex items-center gap-1 mt-0.5">
            <VideoOff className="w-3 h-3" /> Camera is off
          </span>
        </div>
      )}

      {/* Hand Raised Banner */}
      {participant.handRaised && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37] text-[#3C230B] text-xs font-bold shadow-lg animate-bounce">
          <Hand className="w-3.5 h-3.5" /> Adab • Hand Raised
        </div>
      )}

      {/* Pin / Maximize Button */}
      {onTogglePin && (
        <button
          onClick={onTogglePin}
          className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-[#241710]/80 backdrop-blur text-[#D9D0C3] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#3C230B]"
          title={isPinned ? 'Unpin view' : 'Pin to spotlight'}
        >
          {isPinned ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}

      {/* Bottom Name & Status Badge */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#1A1410]/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#3C230B]/50 max-w-[80%] shadow-xs">
          <span className="text-xs font-semibold text-[#FFFCF5] truncate">
            {participant.name}
            {isLocal && ' (You)'}
          </span>
          {participant.isHost && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40">
              <Crown className="w-3 h-3" /> Facilitator
            </span>
          )}
          {participant.isScreenSharing && (
            <span className="text-[10px] text-[#E0C2A6] bg-[#3C230B] px-1.5 py-0.5 rounded border border-[#E0C2A6]/30 font-medium">
              Screen
            </span>
          )}
        </div>

        {/* Mic Status */}
        <div
          className={`p-1.5 rounded-xl backdrop-blur-md border shadow-xs flex items-center justify-center ${
            participant.isMuted
              ? 'bg-red-950/70 text-red-400 border-red-800/40'
              : isSpeaking
              ? 'bg-[#3C230B]/90 text-[#D4AF37] border-[#D4AF37]/60 ring-1 ring-[#D4AF37]/40'
              : 'bg-[#1A1410]/85 text-[#8E7E73] border-[#3C230B]/50'
          }`}
        >
          {participant.isMuted ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
};
