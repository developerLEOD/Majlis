import React from 'react';
import { Download, Film, HardDrive, ShieldCheck, X } from 'lucide-react';
import { RecordingResult } from '../types/meeting';
import { LocalMeetingRecorder } from '../services/localRecorder';

interface RecordingModalProps {
  recording: RecordingResult | null;
  onClose: () => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({ recording, onClose }) => {
  if (!recording) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleDownload = () => {
    LocalMeetingRecorder.downloadFile(recording.blob, recording.fileName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Local Recording Ready</h2>
              <p className="text-xs text-slate-400">Recorded directly on your device • No cloud transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-inner flex items-center justify-center">
            {recording.url ? (
              <video
                src={recording.url}
                controls
                className="w-full h-full object-contain"
                playsInline
              />
            ) : (
              <p className="text-sm text-slate-500">Video preview not available</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">Duration</span>
              <span className="text-base font-semibold text-white">
                {formatDuration(recording.durationSeconds)}
              </span>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">File Size</span>
              <span className="text-base font-semibold text-white">
                {formatSize(recording.sizeBytes)}
              </span>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <span className="text-xs text-slate-400 block mb-1">Storage</span>
              <span className="text-base font-semibold text-emerald-400 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4" /> 100% Local
              </span>
            </div>
          </div>

          {/* Privacy & Unlimited note */}
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-200/90 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300">Device-Only Storage Guarantee</p>
              <p className="text-emerald-400/80 mt-0.5">
                This session was captured and encoded locally in your browser. It was never uploaded to any remote server or third-party cloud.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 truncate max-w-[260px]">
            {recording.fileName}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 rounded-lg shadow-lg shadow-blue-600/30 transition"
            >
              <Download className="w-4 h-4" />
              Download Recording
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
