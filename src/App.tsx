import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/navigation/Sidebar';
import { HomeScreen } from './components/home/HomeScreen';
import { MajalisScreen } from './components/majalis/MajalisScreen';
import { ProfileScreen } from './components/profile/ProfileScreen';
import { SettingsView } from './components/settings/SettingsView';
import { StartMajlisModal } from './components/majalis/StartMajlisModal';
import { PreJoinScreen } from './components/prejoin/PreJoinScreen';
import { MeetingRoom } from './components/MeetingRoom';
import { AuthModal } from './components/auth/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MajlisSession, NavTab } from './types/meeting';
import {
  fetchAppConfig,
  getRoomInfoFromCurrentLocation,
  saveRoomTitleLocally,
  getRoomTitleLocally,
  getBackendApiUrl,
} from './utils/urlHelper';
import { useActiveMajalis, verifyMajlisOngoing } from './hooks/useActiveMajalis';
import {
  createCloudRoom,
  DEFAULT_UPCOMING_SESSIONS,
  endCloudRoomSession,
  subscribeToScheduledSessions,
} from './services/firebaseMeetingSync';

function MainAppContent() {
  const { user, isModerator } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('infinitymeet_username') || 'Araiz Hasan';
  });
  const [userId] = useState(() => 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const [mirrorVideo, setMirrorVideo] = useState(true);

  const [upcomingSessions, setUpcomingSessions] = useState<MajlisSession[]>(DEFAULT_UPCOMING_SESSIONS);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [startModalMode, setStartModalMode] = useState<'start' | 'schedule'>('start');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Pre-join Target
  const [preJoinTarget, setPreJoinTarget] = useState<{
    roomId: string;
    title?: string;
    isHost?: boolean;
  } | null>(() => {
    const info = getRoomInfoFromCurrentLocation();
    if (info && info.roomId) {
      const localTitle = getRoomTitleLocally(info.roomId);
      return {
        roomId: info.roomId,
        title: info.title || localTitle || `Majlis (${info.roomId})`,
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

  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);

  // Live ongoing majalis fetched and synced via WebSocket & REST
  const { activeMajalis, refreshActiveMajalis, addOptimisticMajlis, removeRoom, clearAllActive, loading } = useActiveMajalis(!!activeMeeting);

  useEffect(() => {
    // Subscribe to Firestore scheduled sessions for real-time schedule sync
    let schedUnsub: (() => void) | null = null;
    try {
      schedUnsub = subscribeToScheduledSessions((sessions) => {
        if (Array.isArray(sessions) && sessions.length > 0) {
          setUpcomingSessions(sessions);
        }
      });
    } catch (e) {
      console.warn('Scheduled sessions subscriber error:', e);
    }

    return () => {
      if (schedUnsub) schedUnsub();
    };
  }, []);

  useEffect(() => {
    fetchAppConfig();

    const handleLocationChange = async () => {
      const info = getRoomInfoFromCurrentLocation();
      if (info && info.roomId && !activeMeeting) {
        const cleanedId = info.roomId.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleanedId.length >= 2) {
          // Look up title and host from active list, local title, or URL
          const existing = activeMajalis.find((m) => m.roomId.toLowerCase() === cleanedId);
          const localTitle = getRoomTitleLocally(cleanedId);
          const resolvedTitle = info.title || existing?.title || localTitle || `Majlis (${cleanedId})`;

          setJoinErrorMessage(null);
          setPreJoinTarget((curr) => {
            if (curr && curr.roomId === cleanedId) return curr;
            return {
              roomId: cleanedId,
              title: resolvedTitle,
              isHost: false,
            };
          });
        }
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [activeMeeting, activeMajalis]);

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('infinitymeet_username', newName);
  };

  const handleInitiateJoin = (roomId: string, title?: string) => {
    const existing = activeMajalis.find((m) => m.roomId.toLowerCase() === roomId.toLowerCase());
    const localTitle = getRoomTitleLocally(roomId);
    const resolvedTitle = title || existing?.title || localTitle || `Majlis (${roomId})`;
    setPreJoinTarget({
      roomId,
      title: resolvedTitle,
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
    title?: string;
  }) => {
    const title = params.title || preJoinTarget?.title || 'Live Majlis';
    const chosenName = params.userName.trim() || (user?.email?.split('@')[0]) || userName;

    setUserName(chosenName);
    localStorage.setItem('infinitymeet_username', chosenName);
    setPreJoinTarget(null);

    // Grant host/moderator privileges if entering as host or authenticated as moderator
    const effectiveIsHost = Boolean(params.isHost || isModerator);

    setActiveMeeting({
      roomId: params.roomId,
      title,
      userName: chosenName,
      isHost: effectiveIsHost,
      stream: params.stream,
      isMuted: params.isMuted,
      isVideoOff: params.isVideoOff,
    });

    const newUrl = `${window.location.pathname}?room=${params.roomId}&title=${encodeURIComponent(title)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleEndOrLeaveMeeting = (endedRoomId?: string) => {
    const targetRoomId = endedRoomId || activeMeeting?.roomId;
    if (activeMeeting?.stream) {
      activeMeeting.stream.getTracks().forEach((track) => track.stop());
    }
    if (targetRoomId) {
      removeRoom(targetRoomId);
      endCloudRoomSession(targetRoomId).catch(() => {});
      fetch(getBackendApiUrl('/api/end-majlis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: targetRoomId }),
      }).catch(() => {});
    }
    setActiveMeeting(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleStartNewSession = (newSession: MajlisSession) => {
    setIsStartModalOpen(false);

    // Save locally for Vercel / multi-tab sessions
    saveRoomTitleLocally(newSession.roomId, newSession.title);

    // Optimistically add to active list
    addOptimisticMajlis(newSession);

    // Register on cloud Firestore
    createCloudRoom({
      roomId: newSession.roomId,
      title: newSession.title,
      hostName: newSession.hostName,
    }).catch(console.warn);

    // Register on server
    fetch(getBackendApiUrl('/api/create-majlis'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: newSession.roomId,
        title: newSession.title,
        hostName: newSession.hostName,
      }),
    }).catch(console.warn);

    // Transition host directly into pre-join screen with host flag enabled
    setPreJoinTarget({
      roomId: newSession.roomId,
      title: newSession.title,
      isHost: true,
    });
  };

  // 1. ACTIVE LIVE MEETING VIEW
  if (activeMeeting) {
    return (
      <MeetingRoom
        roomId={activeMeeting.roomId}
        userId={userId}
        userName={activeMeeting.userName}
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
      <>
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
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  // 3. MAIN APPLICATION SHELL
  return (
    <div className="w-full h-screen bg-[#120B07] flex flex-col md:flex-row overflow-hidden font-sans text-[#FFFCF5] antialiased">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        userName={userName}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {currentTab === 'home' && (
          <HomeScreen
            activeMajalis={activeMajalis}
            loadingActiveMajalis={loading}
            upcomingSessions={upcomingSessions}
            onStartMajlis={() => setIsStartModalOpen(true)}
            onJoinMajlis={handleInitiateJoin}
            onClearActive={clearAllActive}
            onRefreshActive={refreshActiveMajalis}
            externalErrorMessage={joinErrorMessage}
            onClearExternalError={() => setJoinErrorMessage(null)}
          />
        )}

        {currentTab === 'majalis' && (
          <MajalisScreen
            activeMajalis={activeMajalis}
            loadingActiveMajalis={loading}
            upcomingSessions={upcomingSessions}
            onJoinMajlis={handleInitiateJoin}
            onStartMajlis={() => {
              setStartModalMode('start');
              setIsStartModalOpen(true);
            }}
            onScheduleMajlis={() => {
              setStartModalMode('schedule');
              setIsStartModalOpen(true);
            }}
            onClearActive={clearAllActive}
            onRefreshActive={refreshActiveMajalis}
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
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          initialMode={startModalMode}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
