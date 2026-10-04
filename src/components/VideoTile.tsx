import React, { useEffect, useRef, useState } from 'react';
import { Crown, Hand, Maximize2, Mic, MicOff, Minimize2, MonitorUp, Sparkles, VideoOff, Volume2 } from 'lucide-react';
import { Participant } from '../types/meeting';
import { createAudioMeter } from '../utils/media';
import { IslamicStarRosette } from './common/IslamicStarRosette';
import { getStainedGlassTheme } from '../utils/stainedGlass';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  mirror?: boolean;
  isPinned?: boolean;
  forceShape?: 'star-medallion' | 'arc-door' | 'honeycomb' | 'standard';
  themeIndex?: number;
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
  themeIndex,
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

  // STAR MEDALLION / OCTAGONAL SPEAKER PORTAL SHAPE (Wisdom Lounge Star Emblem)
  if (shape === 'arc-door' || shape === 'star-medallion') {
    return (
      <div className="relative w-full h-full flex items-center justify-center group select-none transition-all duration-300">
        {/* Outer 8-Sided Star Medallion Glow Frame */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            isSpeaking
              ? 'bg-gradient-to-br from-[#E9A83A] via-[#19A6A0] to-[#E9A83A] opacity-100 scale-105 shadow-[0_0_35px_rgba(233,168,58,0.6)]'
              : 'bg-gradient-to-br from-[#E9A83A] via-[#3A2619] to-[#E9A83A]/80 opacity-90 group-hover:opacity-100'
          }`}
          style={{
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
          }}
        />

        {/* Inner Octagonal Portal Stage */}
        <div
          className="absolute inset-[3.5px] bg-[#160E09] flex items-center justify-center overflow-hidden z-10 transition-colors"
          style={{
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
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
            className={`absolute inset-0 w-full h-full ${objectFitClass} transition-opacity duration-300 ${
              isVideoHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
            } ${mirrorClass}`}
          />

          {/* Camera Off: Only Speaker Name Centered */}
          {isVideoHidden && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-[#24170E] via-[#160E09] to-[#0E0704] p-3 text-center overflow-hidden">
              <h3 className={`text-sm sm:text-base md:text-lg font-bold tracking-tight transition-colors truncate max-w-[90%] ${
                isSpeaking ? 'text-[#E9A83A]' : 'text-[#FFFCF5]'
              }`}>
                {participant.name}
              </h3>
              {isLocal && (
                <span className="text-[10px] text-[#A8988B] font-medium mt-0.5">
                  (You)
                </span>
              )}
              <span className="mt-1.5 text-[8px] sm:text-[9px] font-bold px-2 py-0.5 bg-[#E9A83A]/20 text-[#E9A83A] border border-[#E9A83A]/40 rounded-full uppercase tracking-wider">
                Speaker
              </span>
              {isSpeaking && (
                <div className="flex items-center gap-1 mt-1.5 text-[9px] sm:text-[10px] font-semibold text-[#19A6A0] animate-pulse">
                  <Mic className="w-3 h-3 text-[#E9A83A]" />
                  <span>Speaking</span>
                </div>
              )}
            </div>
          )}

          {/* Hand Raised Badge inside Star */}
          {participant.handRaised && (
            <div className="absolute top-3 sm:top-4 z-20 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] text-[9px] sm:text-[10px] font-bold border border-[#D4982E] shadow-md">
              <Hand className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#1E140C]" /> Hand Raised
            </div>
          )}

          {/* Speaker Overlay Name Tag when video is on */}
          {!isVideoHidden && (
            <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 z-20 flex justify-center pointer-events-none px-2 sm:px-3">
              <div className="flex items-center gap-1.5 bg-[#140D08]/92 backdrop-blur-md px-2 sm:px-2.5 py-0.5 rounded-sm border border-[#3A2619] max-w-[85%] text-center shadow-md">
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#FFFCF5] truncate">
                  {participant.name} {isLocal && '(You)'}
                </span>
                <span className="text-[8px] font-bold px-1 py-0.2 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase">
                  Speaker
                </span>
              </div>
            </div>
          )}

          {/* Mic Muted indicator */}
          {participant.isMuted && (
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 p-1 rounded-sm bg-[#A83245] text-white border border-[#C44056]/70 shadow-md">
              <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
          )}
        </div>
      </div>
    );
  }

  const stainedTheme = getStainedGlassTheme(participant.id || participant.name, themeIndex ?? 0);

  // HONEYCOMB HEXAGONAL JOINT SHAPE FOR REGULAR PARTICIPANTS
  return (
    <div className="relative w-full h-full flex items-center justify-center group select-none transition-all duration-300">
      {/* Outer Hexagon Outer Glow Frame with Stained Glass Leaded Rim */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          isSpeaking
            ? `bg-gradient-to-b ${stainedTheme.speakingBorder} opacity-100 scale-105`
            : `bg-gradient-to-b ${stainedTheme.borderGradient} opacity-90 group-hover:opacity-100 group-hover:scale-102`
        }`}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          boxShadow: isSpeaking ? `0 0 25px ${stainedTheme.glowColor}` : undefined,
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
          className={`absolute inset-0 w-full h-full ${objectFitClass} transition-opacity duration-300 ${
            isVideoHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${mirrorClass}`}
        />

        {/* Camera Off: Stained Glass Facet Decor & Name */}
        {isVideoHidden && (
          <div
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b ${stainedTheme.glassGradient} px-2 py-1 text-center overflow-hidden`}
          >
            {/* Stained Glass Light Sheen / Texture Overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen"
              style={{ background: stainedTheme.glassSheen }}
            />
            {/* Stained Glass Geometric Top-Light Refraction */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.6) 0%, transparent 60%)',
              }}
            />

            {/* Glowing Gem Facet Center Accent */}
            <div
              className="w-1.5 h-1.5 rounded-full mb-1 transition-all z-10"
              style={{
                backgroundColor: stainedTheme.rimColor,
                boxShadow: `0 0 8px ${stainedTheme.rimColor}`,
              }}
            />

            <span
              className="text-xs sm:text-sm font-bold tracking-tight truncate max-w-[88%] transition-colors z-10 block"
              style={{
                color: isSpeaking ? '#FFFFFF' : stainedTheme.textColor,
                textShadow: `0 1px 3px rgba(0,0,0,0.9), 0 0 10px ${stainedTheme.glowColor}`,
              }}
            >
              {participant.name}
            </span>

            {isLocal && (
              <span className="text-[9px] sm:text-[10px] text-[#EAD8C7]/80 font-medium mt-0.5 z-10 block">
                (You)
              </span>
            )}

            {isSpeaking && (
              <span
                className="text-[8px] sm:text-[9px] font-bold mt-1 animate-pulse px-1.5 sm:px-2 py-0.5 rounded-full border z-10 uppercase tracking-wider text-white whitespace-nowrap"
                style={{
                  backgroundColor: stainedTheme.rimColor,
                  borderColor: 'rgba(255,255,255,0.6)',
                  boxShadow: `0 0 10px ${stainedTheme.rimColor}`,
                }}
              >
                ● Speaking
              </span>
            )}
          </div>
        )}

        {/* Video Active Overlay Name Tag */}
        {!isVideoHidden && (
          <div className="absolute bottom-2 left-0 right-0 z-20 flex flex-col items-center justify-center px-1.5 pointer-events-none">
            <div
              className="bg-[#140D08]/92 backdrop-blur-md px-2 py-0.5 rounded-sm border max-w-[90%] text-center shadow-md"
              style={{ borderColor: `${stainedTheme.rimColor}60` }}
            >
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#FFFCF5] truncate block">
                {participant.name}
                {isLocal && ' (You)'}
              </span>
            </div>
          </div>
        )}

        {/* Speaker or Hand Raised Badge inside Hexagon */}
        {participant.handRaised && (
          <div className="absolute top-2.5 z-20 px-1.5 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] text-[8px] sm:text-[9px] font-bold border border-[#D4982E] shadow-md flex items-center gap-1">
            <Hand className="w-2.5 h-2.5 text-[#1E140C]" /> Hand
          </div>
        )}

        {participant.isHost && (
          <div className="absolute top-2.5 z-20 px-1.5 py-0.5 rounded-sm bg-[#E9A83A] text-[#1E140C] text-[8px] sm:text-[9px] font-bold shadow-md flex items-center gap-1">
            <Crown className="w-2.5 h-2.5" /> Mod
          </div>
        )}
      </div>
    </div>
  );
};
