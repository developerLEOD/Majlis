import React from 'react';
import { MajlisSession } from '../../types/meeting';
import { Plus, ArrowRight, Calendar, Users, Loader2 } from 'lucide-react';
import { IslamicStarRosette } from '../common/IslamicStarRosette';

interface MajalisScreenProps {
  activeMajalis: MajlisSession[];
  loadingActiveMajalis?: boolean;
  upcomingSessions: MajlisSession[];
  onJoinMajlis: (roomId: string, title?: string) => void;
  onStartMajlis: () => void;
  onClearActive?: () => void;
}

export const MajalisScreen: React.FC<MajalisScreenProps> = ({
  activeMajalis,
  loadingActiveMajalis,
  upcomingSessions,
  onJoinMajlis,
  onStartMajlis,
  onClearActive,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#120B07] text-[#FFFCF5] p-6 lg:p-10 select-none space-y-8 max-w-6xl w-full mx-auto">
      {/* Directory Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#2A1B12] pb-6">
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#E9A83A] flex items-center gap-1.5">
            <span>SANCTUARY DIRECTORY</span>
            <span>✦</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-[#FFFCF5] tracking-tight">
            Majalis Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#C2B2A3]">
            Explore active ongoing sessions or step into scheduled gatherings.
          </p>
        </div>

        <button
          onClick={onStartMajlis}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] rounded-sm text-xs font-semibold transition-colors shrink-0 border border-[#19A6A0]/40 shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#E9A83A]" />
          <span>Start a Majlis</span>
        </button>
      </div>

      {/* Ongoing Majalis */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#2A1B12] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-[#19A6A0] rounded-full animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#E9A83A]">
              Live Now <span className="text-[#8A7A6D] font-mono font-normal">({activeMajalis.length})</span>
            </h2>
          </div>

          {onClearActive && activeMajalis.length > 0 && (
            <button
              onClick={onClearActive}
              className="text-xs font-medium text-[#8A7A6D] hover:text-[#FFFCF5] underline transition-colors"
            >
              Clear Directory
            </button>
          )}
        </div>

        {loadingActiveMajalis ? (
          <div className="p-4 bg-[#1A110A] border border-[#302116] rounded-sm flex items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-[#E9A83A] animate-spin shrink-0" />
              <span className="text-[#C2B2A3] font-medium">
                Syncing sanctuary circles in real-time...
              </span>
            </div>
            <span className="text-[11px] text-[#E9A83A] font-semibold">
              Connecting
            </span>
          </div>
        ) : activeMajalis.length === 0 ? (
          <div className="p-4 bg-[#1A110A] border border-[#302116] rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
            <span className="text-[#C2B2A3] font-medium">
              It's quiet in the sanctuary right now. Start a Majlis and bring everyone in.
            </span>
            <button
              onClick={onStartMajlis}
              className="font-bold text-[#E9A83A] hover:underline shrink-0"
            >
              Start a Majlis →
            </button>
          </div>
        ) : (
          <div className="border border-[#302116] rounded-sm bg-[#1A110A] divide-y divide-[#302116] shadow-md">
            {activeMajalis.map((session, index) => (
              <div
                key={session.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#22160E] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-xs text-[#8A7A6D] font-bold pt-0.5 shrink-0">
                    M—0{index + 1}
                  </span>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#19A6A0] font-bold text-[11px] uppercase tracking-wider">
                        ACTIVE SESSION
                      </span>
                      <span aria-hidden="true" className="text-[#8A7A6D]">·</span>
                      <span className="text-[#8A7A6D] font-mono text-[11px]">#{session.roomId}</span>
                    </div>

                    <h3 className="text-base font-bold text-[#FFFCF5] tracking-tight">
                      {session.title}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-[#A8988B]">
                      <span>Moderator: <strong className="text-[#E9A83A] font-semibold">{session.hostName}</strong></span>
                      <span aria-hidden="true" className="text-[#8A7A6D]">·</span>
                      <span className="flex items-center gap-1 font-medium text-[#19A6A0]">
                        <Users className="w-3.5 h-3.5" />
                        {session.participantCount ?? 1} {(session.participantCount ?? 1) === 1 ? 'seeker' : 'seekers'} present
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onJoinMajlis(session.roomId, session.title)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] rounded-sm text-xs font-semibold transition-colors shrink-0 self-start sm:self-auto border border-[#19A6A0]/40 shadow-xs"
                >
                  <span>Join Majlis</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E9A83A]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Sessions */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-[#2A1B12] pb-3">
          <Calendar className="w-4 h-4 text-[#E9A83A]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#E9A83A]">
            Your Upcoming Majalis
          </h2>
        </div>

        {upcomingSessions.length === 0 ? (
          <p className="text-xs text-[#8A7A6D] italic">No upcoming sessions scheduled.</p>
        ) : (
          <div className="border border-[#302116] rounded-sm bg-[#1A110A] divide-y divide-[#302116] shadow-md">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-[#22160E] transition-colors"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#FFFCF5]">
                    {session.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#8A7A6D] mt-0.5">
                    <span>{session.scheduledAt}</span>
                    <span aria-hidden="true">·</span>
                    <span>Moderator: {session.hostName}</span>
                  </div>
                </div>

                <button
                  onClick={() => onJoinMajlis(session.roomId, session.title)}
                  className="px-4 py-2 bg-[#075E4A] hover:bg-[#05493A] text-[#FFFCF5] border border-[#19A6A0]/40 rounded-sm text-xs font-semibold transition-colors shrink-0 shadow-xs"
                >
                  Join Circle
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
