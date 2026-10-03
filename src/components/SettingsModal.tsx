import React, { useEffect, useState } from 'react';
import { Camera, Mic, Settings as SettingsIcon, Sliders, Volume2, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white">Audio & Video Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Microphone */}
          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-2">
              <Mic className="w-3.5 h-3.5 text-blue-400" />
              Microphone Input
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
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
              <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 w-7 text-right">{micVolume}%</span>
            </div>
          </div>

          {/* Camera */}
          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-2">
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              Camera Video
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
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

          {/* Mirroring & Video preferences */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-300 block">Mirror My Video</span>
                <span className="text-[11px] text-slate-500">Flip your camera preview horizontally</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleMirror(!mirrorVideo)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  mirrorVideo ? 'bg-blue-600 justify-end' : 'bg-slate-850 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/20 transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
