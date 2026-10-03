import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  HardDrive,
  Mic,
  MicOff,
  Radio,
  Settings,
  ShieldCheck,
  Video,
  VideoOff,
  Zap,
} from 'lucide-react';
import { createAudioMeter, getLocalUserMedia } from '../utils/media';

interface LobbyProps {
  initialRoomId?: string;
  onJoinMeeting: (params: {
    roomId: string;
    userName: string;
    isHost: boolean;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
  }) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ initialRoomId, onJoinMeeting }) => {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('infinitymeet_username') || '';
  });
  const [roomInput, setRoomInput] = useState(initialRoomId || '');
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialRoomId ? 'join' : 'create');
  const [isInitializing, setIsInitializing] = useState(true);

  // Synchronize when initialRoomId prop changes (e.g. from invite link URL)
  useEffect(() => {
    if (initialRoomId) {
      setRoomInput(initialRoomId);
      setActiveTab('join');
    }
  }, [initialRoomId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize preview stream
  useEffect(() => {
    let active = true;

    async function initMedia() {
      setIsInitializing(true);
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
      } catch (e) {
        console.warn('Lobby media init warning:', e);
      } finally {
        if (active) setIsInitializing(false);
      }
    }

    initMedia();

    return () => {
      active = false;
    };
  }, []);

  // Update track enabled state on toggle
  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = isCameraOn));
      stream.getAudioTracks().forEach((track) => (track.enabled = isMicOn));
    }
  }, [isCameraOn, isMicOn, stream]);

  // Audio level meter for mic preview
  useEffect(() => {
    if (!stream || !isMicOn) {
      setMicVolume(0);
      return;
    }
    const cleanup = createAudioMeter(stream, (lvl) => setMicVolume(lvl));
    return cleanup;
  }, [stream, isMicOn]);

  const generateRoomCode = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 9; i++) {
      if (i > 0 && i % 3 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleStartHostMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = userName.trim() || 'Moderator ' + Math.floor(Math.random() * 100);
    localStorage.setItem('infinitymeet_username', finalName);
    const newRoomCode = generateRoomCode();

    onJoinMeeting({
      roomId: newRoomCode,
      userName: finalName,
      isHost: true,
      stream,
      isMuted: !isMicOn,
      isVideoOff: !isCameraOn,
    });
  };

  const handleJoinExistingMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    const finalName = userName.trim() || 'Participant ' + Math.floor(Math.random() * 100);
    localStorage.setItem('infinitymeet_username', finalName);

    const cleanRoomCode = roomInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    onJoinMeeting({
      roomId: cleanRoomCode,
      userName: finalName,
      isHost: false,
      stream,
      isMuted: !isMicOn,
      isVideoOff: !isCameraOn,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Top Banner / Logo */}
      <div className="text-center mb-8 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
          <Zap className="w-3.5 h-3.5" />
          <span>Simple, Limitless Video Conferencing</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Infinity<span className="text-blue-500">Meet</span>
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Host high-quality video meetings with <strong className="text-slate-200">no 40-minute cutoffs</strong> and <strong className="text-slate-200">local on-device recording</strong> for moderators.
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Camera Preview & Test */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Green Room Preview
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-400">Ready</span>
              </div>
            </div>

            {/* Video Preview Box */}
            <div className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 scale-x-[-1] ${
                  !isCameraOn ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {!isCameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                    <VideoOff className="w-8 h-8" />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Camera is Off</span>
                </div>
              )}

              {/* Mic volume bar in preview */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                {isMicOn ? (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                )}
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Controls below video */}
            <div className="flex items-center justify-center gap-4 mt-5">
              <button
                type="button"
                onClick={() => setIsMicOn(!isMicOn)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                  isMicOn
                    ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750'
                    : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {isMicOn ? 'Mic On' : 'Muted'}
              </button>

              <button
                type="button"
                onClick={() => setIsCameraOn(!isCameraOn)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                  isCameraOn
                    ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750'
                    : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {isCameraOn ? <Camera className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {isCameraOn ? 'Camera On' : 'Camera Off'}
              </button>
            </div>
          </div>

          {/* Value Props Footer */}
          <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>No 40-min limit (Unlimited)</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Record locally on device</span>
            </div>
          </div>
        </div>

        {/* Right Column: Name & Join / Create Form */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-slate-900">
          <div>
            {/* Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                New Meeting (Host)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'join'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Join Meeting
              </button>
            </div>

            {/* If invited via link, show prominent invitation notice */}
            {initialRoomId && activeTab === 'join' && (
              <div className="mb-5 p-3 bg-blue-500/15 border border-blue-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider block">
                    Meeting Invitation
                  </span>
                  <span className="text-xs text-white">
                    Invited to join room <strong className="font-mono font-bold text-blue-400">{initialRoomId}</strong>
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            )}

            {/* Display Name Input */}
            <div className="mb-5">
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Conditional Tab Content */}
            {activeTab === 'create' ? (
              <form onSubmit={handleStartHostMeeting} className="space-y-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <div className="flex items-start gap-2.5 text-xs text-blue-300">
                    <Radio className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block mb-0.5">
                        Moderator Host Role
                      </span>
                      You will have full moderator privileges: mute-all, room lock, and recording session locally on your device.
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Start Meeting as Moderator
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinExistingMeeting} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    Meeting ID or Room Code
                  </label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="e.g. abc-def-ghi"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!roomInput.trim()}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 active:scale-98 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Join Meeting
                </button>
              </form>
            )}
          </div>

          {/* Privacy badge */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Encrypted peer-to-peer connection • No download required</span>
          </div>
        </div>
      </div>
    </div>
  );
};
