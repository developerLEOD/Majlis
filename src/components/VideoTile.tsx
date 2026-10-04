import React, { useEffect, useRef, useState } from 'react';
import { Crown, Hand, Maximize2, Mic, MicOff, Minimize2, MonitorUp, Sparkles, VideoOff, Volume2 } from 'lucide-react';
import { Participant } from '../types/meeting';
import { createAudioMeter } from '../utils/media';
import { IslamicStarRosette } from './common/IslamicStarRosette';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  mirror?: boolean;
  isPinned?: boolean;
  forceShape?: 'arc-door' | 'honeycomb' | 'standard';
  onTogglePin?: () => void;
  onToggleSpeaker?: () => void;
  videoRefCallback?: (element: HTMLVideoElement | null) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal,
  mirror = false,
  isPinned = false,
  forceShape,
  onTogglePin,
  onToggleSpeaker,
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

  const shape = forceShape || (participant.isSpeaker ? 'arc-door' : 'honeycomb');

  // ARC DOOR SPEAKER PORTAL SHAPE
  if (shape === 'arc-door') {
    return (
      <div
        className={`relative w-full h-full bg-gradient-to-b from-[#2A1B12] via-[#1A110A] to-[#120B06] rounded-t-[70px] sm:rounded-t-[90px] rounded-b-sm border-2 transition-all duration-300 select-none group flex items-center justify-center shadow-2xl overflow-hidden ${
          isSpeaking
            ? 'border-[#E9A83A] shadow-[0_0_35px_rgba(233,168,58,0.45)] ring-2 ring-[#075E4A]'
            : 'border-[#E9A83A]/70 hover:border-[#E9A83A]'
        }`}
      >
        {/* Top Arch Keystone Logo / Rosette Emblem */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#180F09]/95 border border-[#E9A83A]/80 shadow-md">
          <IslamicStarRosette variant="full" size={16} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#E9A83A]">
            SPEAKER
          </span>
        </div>

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

        {/* Moorish Arch Stained Glass Avatar Portal when Camera is Off */}
        {isVideoHidden && (
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#24170E] via-[#1A110B] to-[#100A05] pt-6">
            <div className="absolute -top-10 -right-10 w-56 h-56 bg-[#E9A83A]/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-[#075E4A]/25 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center justify-center p-5 rounded-t-full rounded-b-sm border border-[#E9A83A]/40 bg-gradient-to-b from-[#2C1C12]/90 via-[#1F140D]/95 to-[#120B06] shadow-2xl min-w-[200px] max-w-[280px]">
              <div className="mb-2 mt-2">
                <IslamicStarRosette variant="full" size={26} />
              </div>

              <div className="relative my-2">
                <div
                  className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold transition-all shadow-xl ${
                    isSpeaking
                      ? 'bg-gradient-to-br from-[#075E4A] to-[#043328] text-[#FFFCF5] border-2 border-[#E9A83A] scale-105 ring-4 ring-[#E9A83A]/40'
                      : 'bg-gradient-to-br from-[#075E4A] to-[#032920] text-[#FFFCF5] border-2 border-[#E9A83A]/60'
                  }`}
                >
                  {initials}
                </div>

                {isSpeaking && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#E9A83A] text-[#1E140C] flex items-center justify-center border-2 border-[#160E09] shadow-md animate-bounce">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div className="text-center mt-2 space-y-1">
                <h3 className="text-sm font-bold text-[#FFFCF5] tracking-tight">
                  {participant.name}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] font-bold text-[10px]">
                  <Sparkles className="w-2.5 h-2.5" /> Assigned Speaker
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hand Raised Badge */}
        {participant.handRaised && (
          <div className="absolute top-10 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#E9A83A] text-[#1E140C] text-xs font-bold border border-[#D4982E] shadow-lg">
            <Hand className="w-3.5 h-3.5 text-[#1E140C]" /> Hand Raised
          </div>
        )}

        {/* Pin Button */}
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className="absolute top-10 right-3 z-20 p-1.5 rounded-sm bg-[#160E09]/90 text-[#D9D0C3] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2A1B12] border border-[#3A2619] shadow-md"
            title={isPinned ? 'Unpin view' : 'Pin to spotlight'}
          >
            {isPinned ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Bottom Cartouche */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 bg-[#160E09]/90 backdrop-blur-md px-2.5 py-1 rounded-sm border border-[#3A2619] max-w-[80%] shadow-md">
            <span className="text-xs font-semibold text-[#FFFCF5] truncate">
              {participant.name} {isLocal && '(You)'}
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-[#E9A83A] text-[#1E140C]">
              Speaker
            </span>
          </div>

          <div
            className={`p-1.5 rounded-sm border flex items-center justify-center shadow-md ${
              participant.isMuted
                ? 'bg-[#A83245] text-white border-[#C44056]/70'
                : isSpeaking
                ? 'bg-[#075E4A] text-[#E9A83A] border-[#E9A83A]'
                : 'bg-[#160E09]/90 backdrop-blur-md text-[#8E7E73] border-[#3A2619]'
            }`}
          >
            {participant.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-[#19A6A0]" />}
          </div>
        </div>
      </div>
    );
  }

  // HONEYCOMB HEXAGONAL JOINT SHAPE FOR REGULAR PARTICIPANTS
  return (
    <div className="relative w-full aspect-square flex items-center justify-center group select-none transition-all duration-300">
      {/* Outer Hexagon Outer Glow Frame */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          isSpeaking
            ? 'bg-gradient-to-b from-[#E9A83A] via-[#075E4A] to-[#E9A83A] opacity-100 scale-105'
            : 'bg-gradient-to-b from-[#3A2619] via-[#24170E] to-[#3A2619] group-hover:from-[#E9A83A]/60'
        }`}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
      />

      {/* Inner Hexagon Tile Body */}
      <div
        className="absolute inset-[3px] bg-[#160E09] flex items-center justify-center overflow-hidden z-10 transition-colors"
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
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
          muted={isLocal}
          className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${
            isVideoHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${mirrorClass}`}
        />

        {/* Camera Off Avatar in Hexagon */}
        {isVideoHidden && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#20150E] via-[#160E09] to-[#0F0804] p-3 text-center">
            <IslamicStarRosette size={20} variant="full" className="mb-1 opacity-70" />
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${
                isSpeaking
                  ? 'bg-[#075E4A] text-[#FFFCF5] border-2 border-[#E9A83A]'
                  : 'bg-[#075E4A] text-[#FFFCF5] border border-[#19A6A0]/50'
              }`}
            >
              {initials}
            </div>
          </div>
        )}

        {/* Hexagon Overlay Name & Mic Pip */}
        <div className="absolute bottom-2.5 left-0 right-0 z-20 flex flex-col items-center justify-center px-2 pointer-events-none">
          <div className="bg-[#140D08]/92 backdrop-blur-md px-2 py-0.5 rounded-sm border border-[#3A2619] max-w-[90%] text-center shadow-md">
            <span className="text-[11px] font-semibold text-[#FFFCF5] truncate block">
              {participant.name}
              {isLocal && ' (You)'}
            </span>
          </div>
        </div>

        {/* Speaker or Hand Raised Badge inside Hexagon */}
        {participant.handRaised && (
          <div className="absolute top-3 z-20 px-1.5 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] text-[9px] font-bold border border-[#D4982E] shadow-md flex items-center gap-1">
            <Hand className="w-2.5 h-2.5 text-[#1E140C]" /> Hand
          </div>
        )}

        {participant.isHost && (
          <div className="absolute top-3 z-20 px-1.5 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] text-[9px] font-bold shadow-md flex items-center gap-1">
            <Crown className="w-2.5 h-2.5" /> Mod
          </div>
        )}
      </div>
    </div>
  );
};
