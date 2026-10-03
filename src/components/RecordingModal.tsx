import React, { useState } from 'react';
import {
  Check,
  Cloud,
  CloudUpload,
  Copy,
  Download,
  Film,
  HardDrive,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { RecordingResult } from '../types/meeting';
import { LocalMeetingRecorder } from '../services/localRecorder';
import { copyTextToClipboard } from '../utils/urlHelper';

interface RecordingModalProps {
  recording: RecordingResult | null;
  onClose: () => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({ recording, onClose }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cloudUrl, setCloudUrl] = useState<string | null>(null);
  const [copiedCloudLink, setCopiedCloudLink] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleUploadToCloud = async () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const storageRef = ref(storage, `recordings/${recording.fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, recording.blob);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error('Cloud upload error:', error);
          setUploadError(error.message || 'Failed to upload recording to Cloud Storage');
          setIsUploading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setCloudUrl(downloadUrl);
          setIsUploading(false);
        }
      );
    } catch (err: any) {
      console.error('Cloud upload exception:', err);
      setUploadError(err.message || 'Cloud storage upload failed');
      setIsUploading(false);
    }
  };

  const handleCopyCloudLink = async () => {
    if (!cloudUrl) return;
    const success = await copyTextToClipboard(cloudUrl);
    if (success) {
      setCopiedCloudLink(true);
      setTimeout(() => setCopiedCloudLink(false), 2500);
    }
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
                Majlis Recording Ready
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
                Cloud Sync
              </span>
              <span className="text-sm font-semibold text-[#3C230B] flex items-center gap-1.5">
                {cloudUrl ? (
                  <span className="text-emerald-800 flex items-center gap-1">
                    <Cloud className="w-4 h-4 text-emerald-600" /> Saved
                  </span>
                ) : (
                  <span className="text-[#68594E] flex items-center gap-1">
                    <HardDrive className="w-4 h-4 text-[#8E7E73]" /> Local + Cloud Option
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Cloud Upload Action Box */}
          {cloudUrl ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <Cloud className="w-4 h-4 text-emerald-600" /> Uploaded to Firebase Cloud Storage
                </div>
                <button
                  onClick={handleCopyCloudLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition shadow-xs"
                >
                  {copiedCloudLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCloudLink ? 'Link Copied!' : 'Copy Cloud Link'}</span>
                </button>
              </div>
              <div className="text-[11px] font-mono text-emerald-800 truncate bg-emerald-100/60 p-2 rounded-lg">
                {cloudUrl}
              </div>
            </div>
          ) : isUploading ? (
            <div className="p-4 bg-[#F5F2EB] border border-[#E6DFD5] rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#3C230B]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /> Uploading to Cloud Storage...
                </div>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#D9D0C3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3C230B] transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#F5F2EB] border border-[#E6DFD5] rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#3C230B] flex items-center gap-1.5">
                  <CloudUpload className="w-4 h-4 text-[#D4AF37]" /> Save to Cloud Storage
                </p>
                <p className="text-[11px] text-[#68594E]">
                  Upload to Firebase Cloud Storage to generate a shareable cloud link.
                </p>
              </div>
              <button
                onClick={handleUploadToCloud}
                className="px-4 py-2 bg-[#241710] hover:bg-[#3C230B] text-[#FFFCF5] rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 shadow-xs"
              >
                <CloudUpload className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Upload to Cloud</span>
              </button>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {uploadError}
            </div>
          )}

          {/* Privacy Note */}
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 text-xs text-emerald-900 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">Dual Recording Standard</p>
              <p className="text-emerald-800/90 mt-0.5">
                Recordings are captured HD on-device. You can download directly to your computer or upload to Firebase Cloud Storage for remote sharing.
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
