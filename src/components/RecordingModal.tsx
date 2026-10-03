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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-[#FFFCF5] border border-[#E6DFD5] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6DFD5] bg-[#F5F2EB]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3C230B]/10 border border-[#3C230B]/20 flex items-center justify-center text-[#3C230B]">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-[#8E7E73] block">
                The Wisdom Lounge
              </span>
              <h2 className="font-editorial text-xl font-bold text-[#3C230B]">
                Local Majlis Recording Ready
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E7E73] hover:text-[#3C230B] rounded-lg hover:bg-[#EFECE4] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-[#D9D0C3] shadow-inner flex items-center justify-center">
            {recording.url ? (
              <video
                src={recording.url}
                controls
                className="w-full h-full object-contain"
                playsInline
              />
            ) : (
              <p className="text-sm text-[#8E7E73]">Video preview not available</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F5F2EB] border border-[#E6DFD5] rounded-xl p-3">
              <span className="text-[10px] text-[#8E7E73] uppercase font-semibold block mb-1">
                Duration
              </span>
              <span className="text-sm font-semibold text-[#3C230B]">
                {formatDuration(recording.durationSeconds)}
              </span>
            </div>
            <div className="bg-[#F5F2EB] border border-[#E6DFD5] rounded-xl p-3">
              <span className="text-[10px] text-[#8E7E73] uppercase font-semibold block mb-1">
                File Size
              </span>
              <span className="text-sm font-semibold text-[#3C230B]">
                {formatSize(recording.sizeBytes)}
              </span>
            </div>
            <div className="bg-[#F5F2EB] border border-[#E6DFD5] rounded-xl p-3">
              <span className="text-[10px] text-[#8E7E73] uppercase font-semibold block mb-1">
                Storage
              </span>
              <span className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-600" /> 100% On-Device
              </span>
            </div>
          </div>

          {/* Privacy Guarantee Note */}
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-900 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">On-Device Privacy Standard</p>
              <p className="text-emerald-800/90 mt-0.5">
                This study circle was recorded directly within your browser onto your computer’s disk. No audio or video data was stored on external cloud servers.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-[#F5F2EB]/80 border-t border-[#E6DFD5] flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#8E7E73] font-mono truncate max-w-[260px]">
            {recording.fileName}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-[#68594E] hover:text-[#3C230B] rounded-xl border border-[#D9D0C3] hover:bg-[#EFECE4] transition"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-[#FFFCF5] bg-[#3C230B] hover:bg-[#2B1706] active:scale-[0.99] rounded-xl shadow-sm transition"
            >
              <Download className="w-4 h-4 text-[#E0C2A6]" />
              <span>Download Recording</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
