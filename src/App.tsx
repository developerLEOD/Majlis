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
import {
  MajlisSession,
  NavTab,
} from './types/meeting';
import { fetchAppConfig, getRoomCodeFromCurrentLocation } from './utils/urlHelper';

const INITIAL_MAJALIS: MajlisSession[] = [
  {
    id: 's-1',
    roomId: 'quran-tafsir',
    title: 'The Exegesis of the Noble Quran',
    scheduledAt: 'Happening Now',
    status: 'live',
    hostName: 'Shaykh Abdullah',
  },
  {
    id: 's-2',
    roomId: 'ihya-ilm',
    title: 'Kitab al-Ilm: The Book of Knowledge',
    scheduledAt: 'Today • 8:00 PM',
    status: 'upcoming',
    hostName: 'Ustadh Taha',
  },
  {
    id: 's-3',
    roomId: 'shamail',
    title: 'Al-Shama’il al-Muhammadiyya',
    scheduledAt: 'Tomorrow • 7:30 PM',
    status: 'upcoming',
    hostName: 'Ustadha Fatima',
  },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('infinitymeet_username') || 'Member';
  });
  const [userId] = useState(() => 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const [mirrorVideo, setMirrorVideo] = useState(true);

  const [sessions, setSessions] = useState<MajlisSession[]>(INITIAL_MAJALIS);
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
    isHost: boolean;
    stream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
  } | null>(null);

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
    const title = preJoinTarget?.title || 'Majlis';

    setPreJoinTarget(null);

    setActiveMeeting({
      roomId: params.roomId,
      title,
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
    setSessions((prev) => [newSession, ...prev]);
    setIsStartModalOpen(false);

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
        userName={userName}
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
            sessions={sessions}
            onStartMajlis={() => setIsStartModalOpen(true)}
            onJoinMajlis={handleInitiateJoin}
          />
        )}

        {currentTab === 'majalis' && (
          <MajalisScreen
            sessions={sessions}
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
