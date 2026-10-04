import React, { useEffect, useState } from 'react';
import { Camera, Mic, Volume2, X } from 'lucide-react';
import { createAudioMeter } from '../utils/media';
import { IslamicStarRosette } from './common/IslamicStarRosette';

interface SettingsModalProps {
  onClose: () => void;
  localStream: MediaStream | null;
  onDeviceChange?: (audioDeviceId?: string, videoDeviceId?: string) => void;
  mirrorVideo: boolean;
  onToggleMirror: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  localStream,
  onDeviceChange,
  mirrorVideo,
  onToggleMirror,
}) => {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [micVolume, setMicVolume] = useState<number>(0);

  useEffect(() => {
    async function loadDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        const cams = devices.filter((d) => d.kind === 'videoinput');

        setAudioDevices(mics);
        setVideoDevices(cams);

        if (mics.length > 0 && !selectedAudioId) setSelectedAudioId(mics[0].deviceId);
        if (cams.length > 0 && !selectedVideoId) setSelectedVideoId(cams[0].deviceId);
      } catch (err) {
        console.warn('Could not enumerate media devices:', err);
      }
    }
    loadDevices();
  }, [selectedAudioId, selectedVideoId]);

  useEffect(() => {
    if (!localStream) return;
    const cleanup = createAudioMeter(localStream, (level) => {
      setMicVolume(level);
    });
    return cleanup;
  }, [localStream]);

  const handleApply = () => {
    if (onDeviceChange) {
      onDeviceChange(selectedAudioId, selectedVideoId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#FAF8F5] border border-[#302116] rounded-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#EAE4DC]">
          <div className="flex items-center gap-3">
            <IslamicStarRosette size={26} variant="full" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#8A7A6D]">
                THE WISDOM LOUNGE
              </div>
              <h2 className="text-base font-bold text-[#1C1917]">
                Audio & Video Readiness
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

        <div className="space-y-4">
          {/* Microphone */}
          <div>
            <label className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5 mb-1.5">
              <Mic className="w-3.5 h-3.5 text-[#8A7A6D]" />
              Microphone Input
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#D5CABB] text-[#1C1917] text-xs rounded-sm px-3.5 py-2 focus:outline-none focus:border-[#0D3B36]"
            >
              {audioDevices.length > 0 ? (
                audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default System Microphone</option>
              )}
            </select>

            <div className="mt-2 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-[#8A7A6D] shrink-0" />
              <div className="flex-1 h-1.5 bg-[#EAE4DC] rounded-full overflow-hidden border border-[#D5CABB]">
                <div
                  className="h-full bg-[#15803D] transition-all duration-75"
                  style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#8A7A6D] w-7 text-right">{micVolume}%</span>
            </div>
          </div>

          {/* Camera */}
          <div>
            <label className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5 mb-1.5">
              <Camera className="w-3.5 h-3.5 text-[#8A7A6D]" />
              Camera Device
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#D5CABB] text-[#1C1917] text-xs rounded-sm px-3.5 py-2 focus:outline-none focus:border-[#0D3B36]"
            >
              {videoDevices.length > 0 ? (
                videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default Web Camera</option>
              )}
            </select>
          </div>

          {/* Mirroring toggle */}
          <div className="pt-2 border-t border-[#EAE4DC] flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-[#1C1917] block">Mirror Camera</span>
              <span className="text-[#8A7A6D]">Flip preview horizontally</span>
            </div>
            <button
              type="button"
              onClick={() => onToggleMirror(!mirrorVideo)}
              className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                mirrorVideo ? 'bg-[#0D3B36]' : 'bg-[#D9D0C3]'
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

        {/* Buttons */}
        <div className="pt-3 border-t border-[#EAE4DC] flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#7A6C62] hover:text-[#1C1917] font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-white bg-[#0D3B36] hover:bg-[#072B26] rounded-sm font-semibold transition-colors shadow-xs"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
