/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/navigation/Sidebar';
import { HomeScreen } from './components/home/HomeScreen';
import { MajalisScreen } from './components/majalis/MajalisScreen';
import { ProfileScreen } from './components/profile/ProfileScreen';
import { SettingsView } from './components/settings/SettingsView';
import { StartMajlisModal } from './components/majalis/StartMajlisModal';
import { PreJoinScreen } from './components/prejoin/PreJoinScreen';
import { MeetingRoom } from './components/MeetingRoom';
import { MajlisSession, NavTab } from './types/meeting';
import { fetchAppConfig, getRoomCodeFromCurrentLocation } from './utils/urlHelper';
import { useActiveMajalis } from './hooks/useActiveMajalis';

const UPCOMING_MAJALIS: MajlisSession[] = [
  {
    id: 's-1',
    roomId: 'ihya-ilm',
    title: 'Kitab al-Ilm: The Book of Sacred Knowledge',
    scheduledAt: 'Today • 8:00 PM',
    status: 'upcoming',
    hostName: 'Ustadh Taha',
  },
  {
    id: 's-2',
    roomId: 'shamail',
    title: 'Al-Shama’il al-Muhammadiyya: Prophetic Grace',
    scheduledAt: 'Tomorrow • 7:30 PM',
    status: 'upcoming',
    hostName: 'Ustadha Fatima',
  },
  {
    id: 's-3',
    roomId: 'tazkiya-heart',
    title: 'Purification of the Heart & Spiritual Wayfaring',
    scheduledAt: 'Friday • 6:00 PM',
    status: 'upcoming',
    hostName: 'Shaykh Abdullah',
  },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('infinitymeet_username') || 'Member';
  });
  const [userId] = useState(() => 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const [mirrorVideo, setMirrorVideo] = useState(true);

  const [upcomingSessions, setUpcomingSessions] = useState<MajlisSession[]>(UPCOMING_MAJALIS);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Pre-join Target
  const [preJoinTarget, setPreJoinTarget] = useState<{
    roomId: string;
    title?: string;
    isHost?: boolean;
  } | null>(() => {
    const code = getRoomCodeFromCurrentLocation();
    if (code) {
      return {
        roomId: code,
        title: `Majlis (${code})`,
        isHost: false,
      };
    }
    return null;
  });

  // Active Live Meeting State
  const [activeMeeting, setActiveMeeting] = useState<{
    roomId: string;
    title: string;
    userName: string;
    isHost: boolean;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
  } | null>(null);

  // Live ongoing majalis fetched and synced via WebSocket & REST
  const { activeMajalis, addOptimisticMajlis } = useActiveMajalis(!!activeMeeting);

  useEffect(() => {
    fetchAppConfig();

    const handleLocationChange = () => {
      const code = getRoomCodeFromCurrentLocation();
      if (code && !activeMeeting) {
        setPreJoinTarget({
          roomId: code,
          title: `Majlis (${code})`,
          isHost: false,
        });
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [activeMeeting]);

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('infinitymeet_username', newName);
  };

  const handleInitiateJoin = (roomId: string, title?: string) => {
    setPreJoinTarget({
      roomId,
      title: title || `Majlis (${roomId})`,
      isHost: false,
    });
  };

  const handleEnterLiveMeeting = (params: {
    roomId: string;
    userName: string;
    isHost: boolean;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
  }) => {
    const title = preJoinTarget?.title || 'Live Majlis';
    const chosenName = params.userName.trim() || userName;

    setUserName(chosenName);
    localStorage.setItem('infinitymeet_username', chosenName);
    setPreJoinTarget(null);

    setActiveMeeting({
      roomId: params.roomId,
      title,
      userName: chosenName,
      isHost: params.isHost,
      stream: params.stream,
      isMuted: params.isMuted,
      isVideoOff: params.isVideoOff,
    });

    const newUrl = `${window.location.pathname}?room=${params.roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleEndOrLeaveMeeting = () => {
    if (activeMeeting?.stream) {
      activeMeeting.stream.getTracks().forEach((track) => track.stop());
    }
    setActiveMeeting(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleStartNewSession = (newSession: MajlisSession) => {
    setIsStartModalOpen(false);

    // Optimistically add to active list
    addOptimisticMajlis(newSession);

    // Register on server
    fetch('/api/create-majlis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: newSession.roomId,
        title: newSession.title,
        hostName: newSession.hostName,
      }),
    }).catch((e) => console.warn('Room registration notice:', e));

    setPreJoinTarget({
      roomId: newSession.roomId,
      title: newSession.title,
      isHost: true,
    });
  };

  // 1. LIVE MEETING ROOM SCREEN
  if (activeMeeting) {
    return (
      <MeetingRoom
        roomId={activeMeeting.roomId}
        userId={userId}
        userName={activeMeeting.userName || userName}
        sessionTitle={activeMeeting.title}
        isHost={activeMeeting.isHost}
        initialStream={activeMeeting.stream}
        initialMuted={activeMeeting.isMuted}
        initialVideoOff={activeMeeting.isVideoOff}
        onEndOrLeaveMeeting={handleEndOrLeaveMeeting}
      />
    );
  }

  // 2. PRE-JOIN / PREPARATION SCREEN
  if (preJoinTarget) {
    return (
      <PreJoinScreen
        roomId={preJoinTarget.roomId}
        sessionTitle={preJoinTarget.title}
        isHostDefault={preJoinTarget.isHost}
        defaultUserName={userName}
        onEnterMeeting={handleEnterLiveMeeting}
        onCancel={() => {
          setPreJoinTarget(null);
          window.history.pushState({}, '', window.location.pathname);
        }}
      />
    );
  }

  // 3. MAIN APPLICATION SHELL
  return (
    <div className="w-full h-screen bg-[#F5F2EB] flex flex-col md:flex-row overflow-hidden font-sans text-[#241710] antialiased">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        userName={userName}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {currentTab === 'home' && (
          <HomeScreen
            activeMajalis={activeMajalis}
            upcomingSessions={upcomingSessions}
            onStartMajlis={() => setIsStartModalOpen(true)}
            onJoinMajlis={handleInitiateJoin}
          />
        )}

        {currentTab === 'majalis' && (
          <MajalisScreen
            activeMajalis={activeMajalis}
            upcomingSessions={upcomingSessions}
            onJoinMajlis={handleInitiateJoin}
            onStartMajlis={() => setIsStartModalOpen(true)}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileScreen
            userName={userName}
            onUpdateUserName={handleUpdateUserName}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            userName={userName}
            onUpdateUserName={handleUpdateUserName}
            mirrorVideo={mirrorVideo}
            onToggleMirror={setMirrorVideo}
          />
        )}
      </main>

      {isStartModalOpen && (
        <StartMajlisModal
          userName={userName}
          onClose={() => setIsStartModalOpen(false)}
          onStartSession={handleStartNewSession}
        />
      )}
    </div>
  );
}
