import React, { useEffect, useRef, useState } from 'react';
import { Crown, Hand, Maximize2, Mic, MicOff, Minimize2, MonitorUp, VideoOff } from 'lucide-react';
import { Participant } from '../types/meeting';
import { createAudioMeter } from '../utils/media';
import { IslamicStarRosette } from './common/IslamicStarRosette';

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

  // Bind video stream and check tracks
  useEffect(() => {
    const checkTracks = () => {
      if (!participant.stream) {
        setHasVideoTrack(false);
        return;
      }
      const vTracks = participant.stream.getVideoTracks();
      setHasVideoTrack(vTracks.length > 0 && vTracks.some((t) => t.enabled));
    };

    checkTracks();

    if (videoRef.current && participant.stream) {
      if (videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
      if (videoRefCallback) {
        videoRefCallback(videoRef.current);
      }
      videoRef.current.play().catch(() => {});
    }

    // Remote audio playback
    if (!isLocal && audioRef.current && participant.stream) {
      if (audioRef.current.srcObject !== participant.stream) {
        audioRef.current.srcObject = participant.stream;
      }
      audioRef.current.play().catch(() => {});
    }

    if (participant.stream) {
      participant.stream.onaddtrack = checkTracks;
      participant.stream.onremovetrack = checkTracks;
    }
  }, [participant.stream, isLocal, videoRefCallback, participant.isVideoOff, participant.isScreenSharing]);

  // Audio speaking detection
  useEffect(() => {
    if (!participant.stream || participant.isMuted) {
      setIsSpeaking(false);
      return;
    }

    const cleanup = createAudioMeter(participant.stream, (volume) => {
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

  const isVideoHidden = participant.isScreenSharing
    ? !hasVideoTrack
    : (participant.isVideoOff || !hasVideoTrack);

  const objectFitClass = participant.isScreenSharing ? 'object-contain bg-black' : 'object-cover';
  const mirrorClass = mirror && isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : '';

  return (
    <div
      className={`relative w-full h-full bg-[#18100A] rounded-sm overflow-hidden border transition-all duration-200 select-none group flex items-center justify-center shadow-2xl ${
        isSpeaking
          ? 'border-[#E9A83A] shadow-[0_0_30px_rgba(233,168,58,0.4)] ring-2 ring-[#075E4A]/80'
          : 'border-[#3A2619] hover:border-[#5C3D26]'
      }`}
    >
      {/* Architectural Bronze & Gold Corner Mullions */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#E9A83A]/50 z-20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#E9A83A]/50 z-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#E9A83A]/50 z-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#E9A83A]/50 z-20 pointer-events-none" />

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
        muted={isLocal}
        className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${
          isVideoHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${mirrorClass}`}
      />

      {/* Architectural Stained-Glass Avatar Portal Fallback when Camera is Off */}
      {isVideoHidden && (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1E140C] via-[#160E08] to-[#100905]">
          {/* Subtle Ambient Stained Glass Light Reflections */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#E9A83A]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-[#075E4A]/25 rounded-full blur-3xl pointer-events-none" />

          {/* Moorish Stained-Glass Arch Frame */}
          <div className="relative z-10 flex flex-col items-center justify-center p-6 rounded-t-full rounded-b-sm border border-[#E9A83A]/30 bg-gradient-to-b from-[#251810]/80 via-[#1A110B]/90 to-[#120B06] shadow-2xl min-w-[210px] max-w-[300px]">
            {/* Top Keystone Rosette */}
            <div className="mb-2">
              <IslamicStarRosette variant="full" size={24} />
            </div>

            {/* Avatar Medallion with Leaded Ring */}
            <div className="relative my-2">
              <div
                className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold transition-all shadow-xl ${
                  isSpeaking
                    ? 'bg-gradient-to-br from-[#075E4A] to-[#043328] text-[#FFFCF5] border-2 border-[#E9A83A] scale-105 ring-4 ring-[#E9A83A]/40 shadow-[0_0_25px_rgba(233,168,58,0.4)]'
                    : 'bg-gradient-to-br from-[#075E4A] to-[#032920] text-[#FFFCF5] border-2 border-[#E9A83A]/60'
                }`}
              >
                {initials}
              </div>

              {/* Speaking Pip indicator on avatar */}
              {isSpeaking && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#E9A83A] text-[#1E140C] flex items-center justify-center border-2 border-[#160E09] shadow-md animate-bounce">
                  <Mic className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Participant Name & Status */}
            <div className="text-center mt-2.5 space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-[#FFFCF5] tracking-tight leading-tight">
                {participant.name}
              </h3>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#C2B2A3]">
                {participant.isHost ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] font-bold text-[10px]">
                    <Crown className="w-2.5 h-2.5" /> Facilitator
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-[#E9A83A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#19A6A0]" />
                    In Sanctuary
                  </span>
                )}
              </div>
            </div>

            {/* Camera off indication */}
            <div className="mt-3 flex items-center gap-1 text-[10px] text-[#8E7E73] font-mono">
              <VideoOff className="w-3 h-3 text-[#8E7E73]" />
              <span>Camera Off</span>
            </div>
          </div>
        </div>
      )}

      {/* Hand Raised Indicator — Amber Leaded Badge */}
      {participant.handRaised && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-sm bg-[#E9A83A] text-[#1E140C] text-xs font-bold border border-[#D4982E] shadow-lg animate-in fade-in">
          <Hand className="w-3.5 h-3.5 text-[#1E140C]" /> Hand Raised
        </div>
      )}

      {/* Screen Sharing Active Indicator — Emerald Glass Badge */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-sm bg-[#075E4A] text-[#FFFCF5] border border-[#19A6A0]/50 text-xs font-semibold shadow-lg">
          <MonitorUp className="w-3.5 h-3.5 text-[#E9A83A]" /> Presenting Screen
        </div>
      )}

      {/* Pin / Maximize Button */}
      {onTogglePin && (
        <button
          onClick={onTogglePin}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-sm bg-[#160E09]/90 text-[#D9D0C3] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2A1B12] border border-[#3A2619] shadow-md"
          title={isPinned ? 'Unpin view' : 'Pin to spotlight'}
        >
          {isPinned ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Bottom Name & Status Leaded Cartouche */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#160E09]/90 backdrop-blur-md px-2.5 py-1 rounded-sm border border-[#3A2619] max-w-[80%] shadow-md">
          <span className="text-xs font-semibold text-[#FFFCF5] truncate">
            {participant.name}
            {isLocal && ' (You)'}
          </span>
          {participant.isHost && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-[#E9A83A] text-[#1E140C]">
              <Crown className="w-2.5 h-2.5" /> Facilitator
            </span>
          )}
        </div>

        {/* Mic Status Indicator */}
        <div
          className={`p-1.5 rounded-sm border flex items-center justify-center shadow-md ${
            participant.isMuted
              ? 'bg-[#A83245] text-white border-[#C44056]/70'
              : isSpeaking
              ? 'bg-[#075E4A] text-[#E9A83A] border-[#E9A83A]'
              : 'bg-[#160E09]/90 backdrop-blur-md text-[#8E7E73] border-[#3A2619]'
          }`}
        >
          {participant.isMuted ? (
            <MicOff className="w-3 h-3" />
          ) : (
            <Mic className="w-3 h-3 text-[#19A6A0]" />
          )}
        </div>
      </div>
    </div>
  );
};
