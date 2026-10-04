import React, { useState } from 'react';
import {
  Check,
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
import { copyTextToClipboard } from '../utils/urlHelper';
import { IslamicStarRosette } from './common/IslamicStarRosette';

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

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = recording.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadToCloud = async () => {
    if (!storage) {
      setUploadError('Firebase storage is not configured.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const storagePath = `recordings/${recording.fileName}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, recording.blob, {
        contentType: recording.blob.type || 'video/webm',
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          setIsUploading(false);
          setUploadError(error.message || 'Upload failed.');
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setCloudUrl(downloadUrl);
          setIsUploading(false);
        }
      );
    } catch (e: any) {
      setIsUploading(false);
      setUploadError(e?.message || 'Upload error');
    }
  };

  const handleCopyCloudLink = async () => {
    if (!cloudUrl) return;
    const ok = await copyTextToClipboard(cloudUrl);
    if (ok) {
      setCopiedCloudLink(true);
      setTimeout(() => setCopiedCloudLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in">
      <div className="relative w-full max-w-xl bg-[#FAF8F5] border border-[#302116] rounded-md overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4DC] bg-[#F5F2EB]">
          <div className="flex items-center gap-3">
            <IslamicStarRosette size={26} variant="full" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#8A7A6D]">
                THE WISDOM LOUNGE
              </div>
              <h2 className="text-base font-bold text-[#1C1917]">
                Majlis Session Recording
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

        {/* Video Preview */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="relative rounded-sm overflow-hidden bg-black aspect-video border border-[#D5CABB] flex items-center justify-center">
            {recording.url ? (
              <video
                src={recording.url}
                controls
                className="w-full h-full object-contain"
                playsInline
              />
            ) : (
              <p className="text-xs text-[#8A7A6D]">Video preview not available</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm p-3">
              <span className="text-[10px] text-[#8A7A6D] uppercase font-bold block mb-0.5">
                Duration
              </span>
              <span className="font-bold text-[#1C1917]">
                {formatDuration(recording.durationSeconds)}
              </span>
            </div>
            <div className="bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm p-3">
              <span className="text-[10px] text-[#8A7A6D] uppercase font-bold block mb-0.5">
                File Size
              </span>
              <span className="font-bold text-[#1C1917]">
                {formatSize(recording.sizeBytes)}
              </span>
            </div>
            <div className="bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm p-3">
              <span className="text-[10px] text-[#8A7A6D] uppercase font-bold block mb-0.5">
                Storage
              </span>
              <span className="font-bold text-[#15803D] flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" /> Local Device
              </span>
            </div>
          </div>

          {/* Cloud Storage Section */}
          {cloudUrl ? (
            <div className="p-3.5 bg-[#DDE6DC]/50 border border-[#B8CEB5] rounded-sm space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#1E382B] font-bold">
                <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                <span>Uploaded to Cloud Storage</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={cloudUrl}
                  className="flex-1 bg-white border border-[#B8CEB5] rounded-sm px-3 py-1.5 text-xs text-[#1C1917] font-mono select-all"
                />
                <button
                  onClick={handleCopyCloudLink}
                  className="px-3.5 py-1.5 bg-[#0D3B36] hover:bg-[#072B26] text-white font-semibold rounded-sm text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
                >
                  {copiedCloudLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCloudLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          ) : isUploading ? (
            <div className="p-4 bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#1C1917] font-semibold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D3B36]" /> Uploading to cloud...
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#D5CABB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0D3B36] transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-[#F5F2EB] border border-[#E0D7CB] rounded-sm flex items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-[#1C1917] flex items-center gap-1.5">
                  <CloudUpload className="w-4 h-4 text-[#8A7A6D]" /> Cloud Storage Backup
                </p>
                <p className="text-[11px] text-[#6B5E55] mt-0.5">
                  Upload recording to generate a remote shareable link.
                </p>
              </div>
              <button
                onClick={handleUploadToCloud}
                className="px-4 py-2 bg-[#0D3B36] hover:bg-[#072B26] text-white rounded-sm text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
              >
                <CloudUpload className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>Upload</span>
              </button>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 text-[#8C2334] text-xs rounded-sm font-medium">
              {uploadError}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-[#F5F2EB] border-t border-[#EAE4DC] flex items-center justify-between gap-3 text-xs">
          <div className="text-[11px] text-[#8A7A6D] font-mono truncate max-w-[220px]">
            {recording.fileName}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 font-semibold text-[#6B5E55] hover:text-[#1C1917] transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-[#0D3B36] hover:bg-[#072B26] rounded-sm transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>Download MP4/WebM</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
