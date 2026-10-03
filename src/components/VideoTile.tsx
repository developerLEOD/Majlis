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
      className={`relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-200 select-none group flex items-center justify-center ${
        isSpeaking
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Remote audio player */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Video Element */}
      <video
        ref={(el) => {
          videoRef.current = el;
          if (videoRefCallback) videoRefCallback(el);
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-xl transition-transform ${
                isSpeaking
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 scale-105 ring-4 ring-emerald-500/30'
                  : 'bg-gradient-to-tr from-blue-700 to-indigo-600'
              }`}
            >
              {initials}
            </div>
            {isSpeaking && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-md animate-pulse">
                <Mic className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-slate-300 mt-3 truncate max-w-[80%]">
            {participant.name}
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1 mt-1">
            <VideoOff className="w-3 h-3" /> Camera is off
          </span>
        </div>
      )}

      {/* Hand Raised Banner */}
      {participant.handRaised && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow-lg animate-bounce">
          <Hand className="w-3.5 h-3.5" /> Hand Raised
        </div>
      )}

      {/* Pin / Maximize Button */}
      {onTogglePin && (
        <button
          onClick={onTogglePin}
          className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-slate-900/80 backdrop-blur text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800"
          title={isPinned ? 'Unpin view' : 'Pin to spotlight'}
        >
          {isPinned ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}

      {/* Bottom Name & Status Badge */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 max-w-[80%] shadow">
          <span className="text-xs font-semibold text-white truncate">
            {participant.name}
            {isLocal && ' (You)'}
          </span>
          {participant.isHost && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Crown className="w-3 h-3" /> Host
            </span>
          )}
          {participant.isScreenSharing && (
            <span className="text-[10px] text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30 font-medium">
              Screen
            </span>
          )}
        </div>

        {/* Mic Status */}
        <div
          className={`p-1.5 rounded-xl backdrop-blur-md border shadow flex items-center justify-center ${
            participant.isMuted
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : isSpeaking
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/40'
              : 'bg-slate-950/80 text-slate-400 border-slate-800/80'
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
