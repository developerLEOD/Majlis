import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, MicOff } from 'lucide-react';
import { createAudioMeter, getLocalUserMedia } from '../../utils/media';

interface SettingsViewProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
  mirrorVideo: boolean;
  onToggleMirror: (val: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userName,
  mirrorVideo,
  onToggleMirror,
}) => {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      } catch (err) {
        console.warn('Settings media init failed:', err);
      }
    }

    initMedia();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));
      stream.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
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

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFCF5] p-6 lg:p-10 select-none space-y-6 max-w-xl">
      <div className="border-b border-[#E6DFD5] pb-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[#8E7E73] mb-1">
          Configuration
        </div>
        <h1 className="text-2xl font-semibold text-[#1C1917] tracking-tight">
          Settings
        </h1>
      </div>

      <div className="bg-[#F5F2EB] border border-[#E6DFD5] rounded-sm p-5 space-y-5">
        {/* Camera Preview */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#1C1917]">
            Video & Audio Test
          </h2>

          <div className="relative aspect-video rounded-sm bg-black overflow-hidden border border-[#D9D0C3] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${mirrorVideo ? 'scale-x-[-1]' : ''} ${
                !isCameraOn ? 'opacity-0' : 'opacity-100'
              }`}
            />
            {!isCameraOn && (
              <span className="text-xs text-[#8E7E73]">Camera Off</span>
            )}

            {/* Mic indicator */}
            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded-sm text-white flex items-center gap-2 text-xs">
              {isMicOn ? (
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-red-400" />
              )}
              <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className="px-3 py-1.5 rounded-sm text-xs font-medium bg-[#EFECE4] text-[#3C230B] border border-[#D9D0C3]"
            >
              {isMicOn ? 'Mic Active' : 'Mic Muted'}
            </button>
            <button
              onClick={() => setIsCameraOn(!isCameraOn)}
              className="px-3 py-1.5 rounded-sm text-xs font-medium bg-[#EFECE4] text-[#3C230B] border border-[#D9D0C3]"
            >
              {isCameraOn ? 'Camera Active' : 'Camera Off'}
            </button>
          </div>
        </div>

        {/* Video Mirroring */}
        <div className="pt-4 border-t border-[#E6DFD5] flex items-center justify-between text-xs">
          <div>
            <span className="font-medium text-[#1C1917] block">Mirror Camera</span>
            <span className="text-[#8E7E73]">Flip preview horizontally</span>
          </div>
          <button
            onClick={() => onToggleMirror(!mirrorVideo)}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
              mirrorVideo ? 'bg-[#3C230B]' : 'bg-[#D9D0C3]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                mirrorVideo ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
