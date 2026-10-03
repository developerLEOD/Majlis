import React, { useEffect, useState } from 'react';
import { Camera, Mic, Settings as SettingsIcon, Volume2, X } from 'lucide-react';
import { createAudioMeter } from '../utils/media';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-lg bg-[#FFFCF5] border border-[#E6DFD5] rounded-3xl shadow-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EFECE4] flex items-center justify-center text-[#3C230B]">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-[#8E7E73] block">
                The Wisdom Lounge
              </span>
              <h3 className="font-editorial text-lg font-bold text-[#3C230B]">
                Audio & Video Readiness
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E7E73] hover:text-[#3C230B] rounded-lg hover:bg-[#EFECE4] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Microphone */}
          <div>
            <label className="text-xs font-semibold text-[#3C230B] flex items-center gap-2 mb-2">
              <Mic className="w-3.5 h-3.5 text-[#8E7E73]" />
              Microphone Input Device
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full bg-white border border-[#D9D0C3] text-[#241710] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#3C230B]"
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

            {/* Mic Level meter */}
            <div className="mt-2.5 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-[#8E7E73] shrink-0" />
              <div className="flex-1 h-2 bg-[#EFECE4] rounded-full overflow-hidden border border-[#D9D0C3]">
                <div
                  className="h-full bg-emerald-600 transition-all duration-75"
                  style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#8E7E73] w-7 text-right">{micVolume}%</span>
            </div>
          </div>

          {/* Camera */}
          <div>
            <label className="text-xs font-semibold text-[#3C230B] flex items-center gap-2 mb-2">
              <Camera className="w-3.5 h-3.5 text-[#8E7E73]" />
              Camera Video Device
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full bg-white border border-[#D9D0C3] text-[#241710] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#3C230B]"
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
          <div className="pt-2 border-t border-[#E6DFD5] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#3C230B] block">Mirror My Video</span>
                <span className="text-[11px] text-[#8E7E73]">Flip preview horizontally</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleMirror(!mirrorVideo)}
                className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                  mirrorVideo ? 'bg-[#3C230B]' : 'bg-[#D9D0C3]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    mirrorVideo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 pt-4 border-t border-[#E6DFD5] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#68594E] hover:text-[#3C230B] rounded-xl hover:bg-[#EFECE4] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold text-[#FFFCF5] bg-[#3C230B] hover:bg-[#2B1706] rounded-xl shadow-xs transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
