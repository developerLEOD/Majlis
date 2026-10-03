/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Lobby } from './components/Lobby';
import { MeetingRoom } from './components/MeetingRoom';
import { fetchAppConfig, getRoomCodeFromCurrentLocation } from './utils/urlHelper';

export default function App() {
  const [inMeeting, setInMeeting] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId] = useState(() => 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const [userName, setUserName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  // Read room code immediately on initial load (synchronously)
  const [initialRoomParam, setInitialRoomParam] = useState<string>(() => getRoomCodeFromCurrentLocation());

  // Listen to browser history navigation and ensure config is fetched
  useEffect(() => {
    fetchAppConfig();

    const handleLocationChange = () => {
      const code = getRoomCodeFromCurrentLocation();
      if (code) {
        setInitialRoomParam(code);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleJoinMeeting = (params: {
    roomId: string;
    userName: string;
    isHost: boolean;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
  }) => {
    setRoomId(params.roomId);
    setUserName(params.userName);
    setIsHost(params.isHost);
    setLocalStream(params.stream);
    setIsMuted(params.isMuted);
    setIsVideoOff(params.isVideoOff);
    setInMeeting(true);

    // Update browser URL without reloading
    const newUrl = `${window.location.pathname}?room=${params.roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleLeaveMeeting = () => {
    setInMeeting(false);
    // Clean up local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    // Remove query param
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
      {inMeeting ? (
        <MeetingRoom
          roomId={roomId}
          userId={userId}
          userName={userName}
          isHost={isHost}
          initialStream={localStream}
          initialMuted={isMuted}
          initialVideoOff={isVideoOff}
          onLeaveMeeting={handleLeaveMeeting}
        />
      ) : (
        <Lobby
          initialRoomId={initialRoomParam}
          onJoinMeeting={handleJoinMeeting}
        />
      )}
    </div>
  );
}
