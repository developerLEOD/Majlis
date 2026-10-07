import React, { useEffect, useRef, useState } from 'react';
import { Camera, Crown, Hand, Mic, MicOff, VideoOff } from 'lucide-react';
import { Participant } from '../types/meeting';
import { createAudioMeter } from '../utils/media';
import { IslamicStarRosette } from './common/IslamicStarRosette';
import { getStainedGlassTheme } from '../utils/stainedGlass';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  mirror?: boolean;
  isPinned?: boolean;
  canModerate?: boolean;
  onMuteUser?: (userId: string) => void;
  onUnmuteUser?: (userId: string) => void;
  onStopVideoUser?: (userId: string) => void;
  onStartVideoUser?: (userId: string) => void;
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
  canModerate,
  onMuteUser,
  onUnmuteUser,
  onStopVideoUser,
  onStartVideoUser,
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
    const videoEl = videoRef.current;
    const checkTracks = () => {
      if (!participant.stream) {
        setHasVideoTrack(false);
        return;
      }
      const vTracks = participant.stream.getVideoTracks();
      setHasVideoTrack(vTracks.length > 0 && vTracks.some((t) => t.enabled));
    };

    checkTracks();

    if (videoEl && participant.stream) {
      if (videoEl.srcObject !== participant.stream) {
        videoEl.srcObject = participant.stream;
      }
      if (videoRefCallback) {
        videoRefCallback(videoEl);
      }
      videoEl.play().catch(() => {});
    }

    // Remote audio playback
    if (!isLocal && audioRef.current && participant.stream) {
      if (audioRef.current.srcObject !== participant.stream) {
        audioRef.current.srcObject = participant.stream;
      }
      audioRef.current.play().catch(() => {});
    }

    const handleTrackEvent = () => {
      checkTracks();
      if (videoEl && participant.stream) {
        if (videoEl.srcObject !== participant.stream) {
          videoEl.srcObject = participant.stream;
        }
        videoEl.play().catch(() => {});
      }
    };

    if (participant.stream) {
      participant.stream.onaddtrack = handleTrackEvent;
      participant.stream.onremovetrack = handleTrackEvent;
      participant.stream.getTracks().forEach((track) => {
        track.onunmute = handleTrackEvent;
        track.onmute = handleTrackEvent;
      });
    }

    return () => {
      if (participant.stream) {
        participant.stream.getTracks().forEach((track) => {
          track.onunmute = null;
          track.onmute = null;
        });
      }
    };
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

  const isVideoHidden = participant.isScreenSharing
    ? !hasVideoTrack
    : (participant.isVideoOff || !hasVideoTrack);

  const objectFitClass = participant.isScreenSharing ? 'object-contain bg-black' : 'object-cover';
  const mirrorClass = mirror && isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : '';

  const shape = forceShape || (participant.isSpeaker ? 'arc-door' : 'honeycomb');
  const sanctuaryTheme = getStainedGlassTheme(participant.id || participant.name, themeIndex ?? 0);

  const isSpeakerShape = participant.isSpeaker || forceShape === 'star-medallion' || forceShape === 'arc-door' || forceShape === 'standard';

  // 1. SPEAKER / SQUARE SANCTUARY CARD
  if (isSpeakerShape) {
    return (
      <div
        className={`relative w-full h-full flex items-center justify-center group select-none transition-all duration-300 aspect-square rounded-sm overflow-hidden border-2 ${
          isSpeaking
            ? 'border-[#E9A83A] shadow-[0_0_25px_rgba(233,168,58,0.65)]'
            : 'border-[#19A6A0]/60 shadow-xl'
        }`}
        style={{
          backgroundColor: sanctuaryTheme.bgColor,
        }}
      >
        {/* Faint Islamic Star Rosette Watermark (Matching Start a Majlis Card) */}
        <IslamicStarRosette
          variant="watermark"
          size={180}
          className="absolute -right-8 -bottom-8 text-[#E9A83A] opacity-20 pointer-events-none"
        />

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

        {/* Video Element (Muted so autoplay policy never blocks video decoding) */}
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
          muted={true}
          className={`absolute inset-0 w-full h-full ${objectFitClass} transition-opacity duration-300 ${
            isVideoHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${mirrorClass}`}
        />

        {/* Camera Off: Simple, Clean Square Sanctuary Card View */}
        {isVideoHidden && (
          <div className="relative z-10 px-4 py-2 flex flex-col items-center justify-center text-center w-full max-w-[90%] my-auto">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#FFFCF5] tracking-tight truncate max-w-full leading-snug">
              {participant.name}
            </h3>

            {isLocal && (
              <span className="text-[10px] sm:text-[11px] text-[#E0C2A6] font-medium mt-0.5">
                (You)
              </span>
            )}

            <span className="mt-2 text-[9px] sm:text-[10px] font-bold px-2.5 py-0.5 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase tracking-wider shadow-xs">
              Speaker
            </span>

            {isSpeaking && (
              <span className="text-[9px] font-bold px-2.5 py-0.5 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase tracking-wider mt-2 shadow-xs animate-pulse">
                ● Speaking
              </span>
            )}
          </div>
        )}

        {/* Video Active Overlay Name Tag */}
        {!isVideoHidden && (
          <div className="absolute bottom-3 left-0 right-0 z-20 flex flex-col items-center justify-center px-2 pointer-events-none">
            <div className="bg-[#140D08]/92 backdrop-blur-md px-3 py-1 rounded-xs border border-[#3A2619] max-w-[88%] text-center shadow-md flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-semibold text-[#FFFCF5] truncate block">
                {participant.name}
                {isLocal && ' (You)'}
              </span>
              <span className="text-[8px] font-bold px-1.5 py-0.2 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase">
                Speaker
              </span>
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1">
          {participant.handRaised && (
            <div className="px-2 py-0.5 rounded-xs bg-[#E9A83A] text-[#1E140C] text-[9px] font-bold border border-[#D4982E] shadow-md flex items-center gap-1">
              <Hand className="w-3 h-3 text-[#1E140C]" /> Hand Raised
            </div>
          )}

          {participant.isHost && (
            <div className="px-2 py-0.5 rounded-xs bg-[#E9A83A] text-[#1E140C] text-[9px] font-bold shadow-md flex items-center gap-1">
              <Crown className="w-3 h-3 text-[#1E140C]" /> Mod
            </div>
          )}
        </div>

        {/* Muted Mic Indicator */}
        {participant.isMuted && (
          <div className="absolute bottom-3 right-3 z-20 p-1 rounded-xs bg-[#A83245] text-white border border-[#C44056]/70 shadow-md">
            <MicOff className="w-3 h-3" />
          </div>
        )}

        {/* Moderator Hover Controls Overlay */}
        {canModerate && !isLocal && (
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-30 pointer-events-auto">
            {!participant.isMuted && onMuteUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMuteUser(participant.id);
                }}
                className="p-2 rounded-sm bg-[#A83245] text-white hover:bg-[#8B2334] shadow-md transition-transform hover:scale-110"
                title="Mute Microphone"
              >
                <MicOff className="w-4 h-4" />
              </button>
            )}
            {participant.isMuted && onUnmuteUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnmuteUser(participant.id);
                }}
                className="p-2 rounded-sm bg-[#075E4A] text-white hover:bg-[#05493A] shadow-md transition-transform hover:scale-110"
                title="Unmute Microphone"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            {!participant.isVideoOff && onStopVideoUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStopVideoUser(participant.id);
                }}
                className="p-2 rounded-sm bg-[#A83245] text-white hover:bg-[#8B2334] shadow-md transition-transform hover:scale-110"
                title="Turn Off Video"
              >
                <VideoOff className="w-4 h-4" />
              </button>
            )}
            {participant.isVideoOff && onStartVideoUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartVideoUser(participant.id);
                }}
                className="p-2 rounded-sm bg-[#075E4A] text-white hover:bg-[#05493A] shadow-md transition-transform hover:scale-110"
                title="Turn On Video"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. REGULAR ATTENDEE / HEXAGONAL SANCTUARY CARD
  return (
    <div className="relative w-full h-full flex items-center justify-center group select-none transition-all duration-300 aspect-square">
      {/* Outer Hexagon Gold/Emerald Border Frame */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          backgroundColor: isSpeaking ? '#E9A83A' : sanctuaryTheme.borderColor,
          boxShadow: isSpeaking
            ? `0 0 25px ${sanctuaryTheme.glowColor}`
            : '0 4px 15px rgba(0,0,0,0.5)',
        }}
      />

      {/* Inner Hexagonal Sanctuary Card Body */}
      <div
        className="absolute inset-[3px] flex flex-col items-center justify-center overflow-hidden z-10 transition-colors"
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          backgroundColor: sanctuaryTheme.bgColor,
        }}
      >
        {/* Faint Islamic Star Rosette Watermark (Matching Start a Majlis Card) */}
        <IslamicStarRosette
          variant="watermark"
          size={160}
          className="absolute -right-6 -bottom-6 text-[#E9A83A] opacity-20 pointer-events-none"
        />

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

        {/* Video Element (Muted so autoplay policy never blocks video decoding) */}
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
          muted={true}
          className={`absolute inset-0 w-full h-full ${objectFitClass} transition-opacity duration-300 ${
            isVideoHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${mirrorClass}`}
        />

        {/* Camera Off: Simple, Clean Sanctuary Card View */}
        {isVideoHidden && (
          <div className="relative z-10 px-3 py-2 flex flex-col items-center justify-center text-center w-full max-w-[85%] my-auto">
            <h3 className="text-xs sm:text-sm md:text-base font-bold text-[#FFFCF5] tracking-tight truncate max-w-full leading-snug">
              {participant.name}
            </h3>

            {isLocal && (
              <span className="text-[9px] sm:text-[10px] text-[#E0C2A6] font-medium mt-0.5">
                (You)
              </span>
            )}

            {participant.isSpeaker && (
              <span className="mt-1.5 text-[8px] sm:text-[9px] font-bold px-2 py-0.5 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase tracking-wider shadow-xs">
                Speaker
              </span>
            )}

            {isSpeaking && (
              <span className="text-[8px] sm:text-[9px] font-bold px-2 py-0.5 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase tracking-wider mt-1.5 shadow-xs animate-pulse">
                ● Speaking
              </span>
            )}
          </div>
        )}

        {/* Video Active Overlay Name Tag */}
        {!isVideoHidden && (
          <div className="absolute bottom-3 left-0 right-0 z-20 flex flex-col items-center justify-center px-2 pointer-events-none">
            <div className="bg-[#140D08]/92 backdrop-blur-md px-2.5 py-0.5 rounded-xs border border-[#3A2619] max-w-[88%] text-center shadow-md flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#FFFCF5] truncate block">
                {participant.name}
                {isLocal && ' (You)'}
              </span>
              {participant.isSpeaker && (
                <span className="text-[8px] font-bold px-1 py-0.2 bg-[#E9A83A] text-[#1E140C] rounded-xs uppercase">
                  Speaker
                </span>
              )}
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 z-20 flex items-center gap-1">
          {participant.handRaised && (
            <div className="px-1.5 py-0.5 rounded-xs bg-[#E9A83A] text-[#1E140C] text-[8px] font-bold border border-[#D4982E] shadow-md flex items-center gap-1">
              <Hand className="w-2.5 h-2.5 text-[#1E140C]" /> Hand
            </div>
          )}

          {participant.isHost && (
            <div className="px-1.5 py-0.5 rounded-xs bg-[#E9A83A] text-[#1E140C] text-[8px] font-bold shadow-md flex items-center gap-1">
              <Crown className="w-2.5 h-2.5 text-[#1E140C]" /> Mod
            </div>
          )}
        </div>

        {/* Muted Mic Indicator */}
        {participant.isMuted && (
          <div className="absolute bottom-2.5 right-3 z-20 p-1 rounded-xs bg-[#A83245] text-white border border-[#C44056]/70 shadow-md">
            <MicOff className="w-2.5 h-2.5" />
          </div>
        )}

        {/* Moderator Hover Controls Overlay */}
        {canModerate && !isLocal && (
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-30 pointer-events-auto">
            {!participant.isMuted && onMuteUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMuteUser(participant.id);
                }}
                className="p-1.5 rounded-sm bg-[#A83245] text-white hover:bg-[#8B2334] shadow-md transition-transform hover:scale-110"
                title="Mute Microphone"
              >
                <MicOff className="w-3.5 h-3.5" />
              </button>
            )}
            {participant.isMuted && onUnmuteUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnmuteUser(participant.id);
                }}
                className="p-1.5 rounded-sm bg-[#075E4A] text-white hover:bg-[#05493A] shadow-md transition-transform hover:scale-110"
                title="Unmute Microphone"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            )}
            {!participant.isVideoOff && onStopVideoUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStopVideoUser(participant.id);
                }}
                className="p-1.5 rounded-sm bg-[#A83245] text-white hover:bg-[#8B2334] shadow-md transition-transform hover:scale-110"
                title="Turn Off Video"
              >
                <VideoOff className="w-3.5 h-3.5" />
              </button>
            )}
            {participant.isVideoOff && onStartVideoUser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartVideoUser(participant.id);
                }}
                className="p-1.5 rounded-sm bg-[#075E4A] text-white hover:bg-[#05493A] shadow-md transition-transform hover:scale-110"
                title="Turn On Video"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
