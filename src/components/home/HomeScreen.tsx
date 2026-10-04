import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Link as LinkIcon,
  Loader2,
  Video,
  X,
} from 'lucide-react';
import { MajlisSession } from '../../types/meeting';
import { IslamicStarRosette } from '../common/IslamicStarRosette';
import { verifyMajlisOngoing } from '../../hooks/useActiveMajalis';
import { SanctuaryLoader } from '../common/SanctuaryLoader';
import heroStainedGlassImg from '../../assets/images/hero_stained_glass_1791101546981.jpg';
import wisdomPortraitImg from '../../assets/images/wisdom_portrait_glass_1791101565686.jpg';

interface HomeScreenProps {
  activeMajalis: MajlisSession[];
  upcomingSessions: MajlisSession[];
  onStartMajlis: () => void;
  onJoinMajlis: (roomId: string, title?: string) => void;
  onClearActive?: () => void;
  externalErrorMessage?: string | null;
  onClearExternalError?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activeMajalis,
  upcomingSessions: propUpcoming,
  onStartMajlis,
  onJoinMajlis,
  externalErrorMessage,
  onClearExternalError,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const displayError = externalErrorMessage || errorMessage;

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim() || isVerifying) return;

    setErrorMessage(null);
    onClearExternalError?.();
    setIsVerifying(true);

    try {
      const result = await verifyMajlisOngoing(inputCode, activeMajalis);

      if (!result.isOngoing) {
        setErrorMessage(
          result.error ||
            `No ongoing Majlis session found matching "${inputCode.trim()}". Please check the code or start a new Majlis.`
        );
        setIsVerifying(false);
        return;
      }

      // Valid ongoing session found!
      setErrorMessage(null);
      setIsVerifying(false);
      onJoinMajlis(result.roomId, result.title);
    } catch (err) {
      setErrorMessage('Unable to verify session at this moment. Please check your connection and try again.');
      setIsVerifying(false);
    }
  };

  const handleDirectActiveJoin = (roomId: string, title?: string) => {
    setErrorMessage(null);
    onClearExternalError?.();
    onJoinMajlis(roomId, title);
  };

  // Curated upcoming sessions with authentic Stained Glass jewel tones
  const defaultUpcoming = [
    {
      id: 'up_1',
      title: 'The Exegesis of the Noble Quran',
      series: 'Surah An-Nisa · Session 04',
      date: 'Today · 8:00 PM',
      facilitator: 'Sana Amjad',
      colorBg: 'bg-[#075E4A]',
      colorBorder: 'border-[#19A6A0]/50',
      starVariant: 'full' as const,
      isPrimaryAction: true,
      roomId: 'quran-tafsir-04',
    },
    {
      id: 'up_2',
      title: 'Adab & Fahm al-Din',
      series: 'Introductory Series · Session 02',
      date: 'Tomorrow · 7:30 PM',
      facilitator: 'Rahim Muhammad Syed',
      colorBg: 'bg-[#174A83]',
      colorBorder: 'border-[#2D6BB5]/50',
      starVariant: 'full' as const,
      isPrimaryAction: false,
      roomId: 'adab-fahm-02',
    },
    {
      id: 'up_3',
      title: 'Abu Bakr RA',
      series: 'Audio Study · Session 01',
      date: 'Sat, 12 Oct · 8:00 PM',
      facilitator: 'Sheikh Anwar Al-Awlaki',
      colorBg: 'bg-[#302116]',
      colorBorder: 'border-[#E9A83A]/40',
      starVariant: 'full' as const,
      isPrimaryAction: false,
      roomId: 'abu-bakr-audio-01',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#120B07] text-[#FFFCF5] select-none flex flex-col min-h-screen relative">
      {isVerifying && (
        <SanctuaryLoader message="Verifying Majlis..." subMessage="Checking active sanctuary session in cloud" />
      )}
      {/* 1. HERO SECTION WITH STAINED GLASS BACKGROUND */}
      <div className="relative w-full bg-[#180F09] overflow-hidden pt-8 pb-10 px-6 sm:px-10 lg:px-12 shrink-0 border-b border-[#2A1B12]">
        {/* Photographic Mosque Stained Glass Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={heroStainedGlassImg}
            alt="Stained glass windows"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-right brightness-[0.7] contrast-[1.05]"
          />
          {/* Deep dark gradient overlay for crystal clear contrast on text & cards */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#140D08]/96 via-[#140D08]/85 to-[#140D08]/40" />
        </div>

        {/* Hero Title & Eyebrow */}
        <div className="relative z-10 max-w-5xl mb-7 mt-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.22em] uppercase text-[#E9A83A] flex items-center gap-1.5">
              <span>THE WISDOM LOUNGE</span>
              <span>✦</span>
            </span>
            <span className="w-8 h-[1.5px] bg-[#E9A83A]/60" />
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#FFFCF5] mb-2 font-sans">
            Majlis
          </h1>

          <p className="text-xs sm:text-sm text-[#C2B2A3] font-normal max-w-xl">
            A place to think together.
          </p>
        </div>

        {/* Hero Action Cards */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 max-w-5xl">
          {/* Left Card: Start a Majlis (7 columns) — Deep Emerald Glass */}
          <div className="md:col-span-7 bg-[#075E4A] border border-[#19A6A0]/40 rounded-sm p-6 sm:p-7 relative overflow-hidden text-[#FFFCF5] flex flex-col justify-between shadow-xl">
            {/* Islamic Star Rosette Watermark on right */}
            <IslamicStarRosette
              variant="watermark"
              size={240}
              className="absolute -right-12 -bottom-12 text-[#E9A83A] opacity-20 pointer-events-none"
            />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#E9A83A] text-sm">✦</span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#E9A83A] uppercase">
                  START A MAJLIS
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-[#FFFCF5] leading-snug max-w-sm mb-6">
                Begin a conversation,
                <br />
                share knowledge, or host a circle.
              </h2>
            </div>

            <div className="relative z-10">
              <button
                onClick={onStartMajlis}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-[#E9A83A] hover:bg-[#D89828] text-[#1E140C] font-bold text-xs rounded-sm transition-colors shadow-sm"
              >
                <Video className="w-4 h-4 text-[#1E140C]" />
                <span>Start a Majlis</span>
                <ArrowRight className="w-4 h-4 text-[#1E140C]" />
              </button>
            </div>
          </div>

          {/* Right Card: Have a link or code? (5 columns) — Architectural Leaded Bronze */}
          <div className="md:col-span-5 bg-[#1C130C] border border-[#3A2619] rounded-sm p-6 sm:p-7 text-[#FFFCF5] flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-[#E9A83A]" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#E9A83A] uppercase">
                  JOIN A MAJLIS
                </span>
              </div>

              <h2 className="text-lg font-bold text-[#FFFCF5] leading-tight">
                Have a link or code?
              </h2>
              <p className="text-xs text-[#A8988B] mt-1 mb-5">
                Enter it below to step into the sanctuary.
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    if (displayError) {
                      setErrorMessage(null);
                      onClearExternalError?.();
                    }
                  }}
                  placeholder="Majlis link or code (e.g. majlis-xyz)..."
                  disabled={isVerifying}
                  className="flex-1 min-w-0 bg-[#24170F] border border-[#3A2619] rounded-sm px-3.5 py-2 text-xs text-[#FFFCF5] placeholder-[#8A7A6D] focus:outline-none focus:border-[#E9A83A] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!inputCode.trim() || isVerifying}
                  className="px-5 py-2 bg-[#075E4A] hover:bg-[#05493A] disabled:opacity-40 text-[#FFFCF5] font-semibold text-xs rounded-sm transition-colors shrink-0 border border-[#19A6A0]/40 flex items-center justify-center gap-1.5"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E9A83A]" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>Join</span>
                  )}
                </button>
              </div>

              {/* Error Notification when no matching ongoing session exists */}
              {displayError && (
                <div className="p-3 bg-[#331114] border border-[#7E1C2C] rounded-sm text-xs text-[#FCA5A5] flex items-start justify-between gap-2.5 shadow-md animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <strong className="block text-[#FECDD3] font-semibold text-[11px]">
                        Session Not Found
                      </strong>
                      <span className="text-[11px] leading-relaxed text-[#FCA5A5] break-words">
                        {displayError}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      onClearExternalError?.();
                    }}
                    className="text-[#F87171] hover:text-[#FECDD3] p-0.5 shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* 2. LOWER CONTENT AREA: LIVE NOW + UPCOMING + WISDOM CARD */}
      <div className="px-6 sm:px-10 lg:px-12 py-7 max-w-6xl w-full mx-auto flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
          {/* Left Column (8 cols): Live Now + Upcoming Sections */}
          <div className="lg:col-span-8 space-y-6">
            {/* SECTION: LIVE NOW */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#19A6A0] animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#E9A83A]">
                    Live Sanctuary Circles
                  </h3>
                </div>

                <button
                  onClick={onStartMajlis}
                  className="text-xs font-semibold text-[#A8988B] hover:text-[#E9A83A] flex items-center gap-1 transition-colors"
                >
                  <span>Start Majlis</span>
                  <span>→</span>
                </button>
              </div>

              {/* Active Sessions List or Compact Empty State */}
              {activeMajalis.length === 0 ? (
                <div className="bg-[#1A110A] border border-[#302116] rounded-sm p-4 text-xs flex items-center justify-between gap-4 shadow-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-sm bg-[#24170E] border border-[#3A2619] flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4 text-[#8A7A6D]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-[#FFFCF5] block truncate">
                        No active circles right now
                      </span>
                      <span className="text-[11px] text-[#8A7A6D] block truncate">
                        It's quiet in the lounge. Start a Majlis to gather seekers.
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={onStartMajlis}
                    className="px-3.5 py-1.5 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] font-semibold text-xs rounded-sm transition-colors shrink-0 border border-[#19A6A0]/40 shadow-xs"
                  >
                    Host Now
                  </button>
                </div>
              ) : (
                <div className="border border-[#302116] rounded-sm bg-[#1A110A] divide-y divide-[#302116] shadow-md">
                  {activeMajalis.map((session) => (
                    <div
                      key={session.id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-[#22160E] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-sm bg-[#075E4A] border border-[#19A6A0]/50 flex items-center justify-center shrink-0">
                          <IslamicStarRosette size={22} variant="full" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#FFFCF5] truncate">
                            {session.title}
                          </h4>
                          <div className="text-xs text-[#A8988B] mt-0.5 truncate">
                            Room #{session.roomId} · Moderator: <strong className="text-[#E9A83A]">{session.hostName}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDirectActiveJoin(session.roomId, session.title)}
                        className="px-4 py-1.5 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] text-xs font-semibold rounded-sm transition-colors shrink-0 border border-[#19A6A0]/40 self-start sm:self-auto"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION: UPCOMING */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#E9A83A]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#E9A83A]">
                    Upcoming Study Circles
                  </h3>
                </div>

                <span className="text-[11px] text-[#8A7A6D] font-mono">
                  Weekly Schedule
                </span>
              </div>

              {/* Upcoming Scheduled Rows */}
              <div className="space-y-2.5">
                {defaultUpcoming.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#1A110A] border border-[#302116] rounded-sm p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:border-[#E9A83A]/50 transition-colors shadow-md"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Geometric Thumbnail */}
                      <div
                        className={`w-10 h-10 rounded-sm ${item.colorBg} border ${item.colorBorder} flex items-center justify-center shrink-0 overflow-hidden shadow-xs`}
                      >
                        <IslamicStarRosette size={22} variant="full" />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#FFFCF5] truncate">
                          {item.title}
                        </h4>
                        <div className="text-xs text-[#A8988B] mt-0.5 truncate">
                          {item.series}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                      {/* Date & Facilitator */}
                      <div className="text-right text-xs">
                        <div className="font-semibold text-[#FFFCF5]">
                          {item.date}
                        </div>
                        <div className="text-[#8A7A6D] text-[11px]">
                          {item.facilitator}
                        </div>
                      </div>

                      {/* Action Button */}
                      {item.isPrimaryAction ? (
                        <button
                          onClick={() => onJoinMajlis(item.roomId, item.title)}
                          className="px-4 py-1.5 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] text-xs font-semibold rounded-sm transition-colors shrink-0 border border-[#19A6A0]/40 shadow-xs"
                        >
                          Join
                        </button>
                      ) : (
                        <button
                          onClick={() => onJoinMajlis(item.roomId, item.title)}
                          className="px-3.5 py-1.5 bg-[#24170E] hover:bg-[#2F1F14] border border-[#3A2619] text-[#E0C2A6] text-xs font-semibold rounded-sm transition-colors shrink-0"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Vertical Stained Glass Wisdom Card */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="relative rounded-sm overflow-hidden shadow-2xl flex-1 min-h-[380px] flex flex-col justify-between p-7 bg-[#180F09] text-[#FFFCF5] border border-[#302116]">
              {/* Background Stained Glass Light Photograph */}
              <img
                src={wisdomPortraitImg}
                alt="Stained glass sunlight"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover brightness-[0.75]"
              />
              {/* Vignette Overlay for Crisp Readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#140D08]/90 via-[#140D08]/40 to-[#140D08]/90 pointer-events-none" />

              {/* Top Quote Content */}
              <div className="relative z-10 pt-1">
                <div className="w-8 h-[2px] bg-[#E9A83A] mb-3.5" />
                <h3 className="text-xl sm:text-2xl font-bold text-[#FFFCF5] tracking-tight leading-snug">
                  Seek wisdom
                  <br />
                  in good company.
                </h3>
              </div>

              {/* Bottom Gold Rosette Emblem */}
              <div className="relative z-10 pb-1 flex items-center justify-between">
                <IslamicStarRosette variant="gold-outline" size={38} />
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#E9A83A]">
                  Majlis
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
