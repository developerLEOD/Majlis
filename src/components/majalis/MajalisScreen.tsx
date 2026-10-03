import React from 'react';
import { MajlisSession } from '../../types/meeting';
import { PlusCircle, Radio, Users, ArrowRight, Calendar } from 'lucide-react';

interface MajalisScreenProps {
  activeMajalis: MajlisSession[];
  upcomingSessions: MajlisSession[];
  onJoinMajlis: (roomId: string, title?: string) => void;
  onStartMajlis: () => void;
  onClearActive?: () => void;
}

export const MajalisScreen: React.FC<MajalisScreenProps> = ({
  activeMajalis,
  upcomingSessions,
  onJoinMajlis,
  onStartMajlis,
  onClearActive,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-6 lg:p-12 select-none space-y-8">
      <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
            The Wisdom Lounge
          </span>
          <h2 className="text-2xl font-bold text-[#3C230B] mt-0.5">
            Majalis Directory
          </h2>
          <p className="text-xs text-[#68594E] mt-0.5">
            Explore live ongoing circles or join upcoming scholarly discussions.
          </p>
        </div>
        <button
          onClick={onStartMajlis}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] rounded-xl text-xs font-semibold transition shadow-xs"
        >
          <PlusCircle className="w-4 h-4 text-[#E0C2A6]" />
          <span>Start New Majlis</span>
        </button>
      </div>

      {/* 🟢 Ongoing Majalis Section */}
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping absolute opacity-75" />
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full relative" />
            </div>
            <h3 className="text-sm font-bold text-[#3C230B] uppercase tracking-wider">
              Ongoing Majalis ({activeMajalis.length} Live Now)
            </h3>
          </div>
          {onClearActive && activeMajalis.length > 0 && (
            <button
              onClick={onClearActive}
              className="text-[11px] font-semibold text-[#8E7E73] hover:text-[#3C230B] underline transition"
            >
              Clear Directory
            </button>
          )}
        </div>

        {activeMajalis.length === 0 ? (
          <div className="bg-[#FFFCF5]/70 border border-[#E6DFD5] border-dashed rounded-2xl p-6 text-center space-y-2">
            <Radio className="w-6 h-6 text-[#8E7E73] mx-auto opacity-60" />
            <p className="text-xs font-medium text-[#68594E]">
              No active sessions are ongoing at this moment.
            </p>
            <p className="text-[11px] text-[#8E7E73]">
              Start an instant session to begin a live gathering.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMajalis.map((session) => (
              <div
                key={session.id}
                className="bg-[#FFFCF5] border border-[#D4AF37]/50 hover:border-[#D4AF37] rounded-2xl p-5 flex flex-col justify-between space-y-4 transition shadow-xs group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                      LIVE NOW
                    </span>
                    <span className="text-[11px] text-[#8E7E73] font-mono">
                      #{session.roomId}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-[#241710] group-hover:text-[#3C230B] transition">
                    {session.title}
                  </h4>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#68594E]">
                    <span>Facilitator: <strong className="text-[#3C230B]">{session.hostName}</strong></span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                      <Users className="w-3.5 h-3.5" />
                      {session.participantCount ?? 1} {(session.participantCount ?? 1) === 1 ? 'seeker' : 'seekers'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onJoinMajlis(session.roomId, session.title)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] rounded-xl text-xs font-semibold transition shadow-xs"
                >
                  <span>Join Live Majlis</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📅 Upcoming Sessions Section */}
      <div className="space-y-4 max-w-4xl pt-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#8E7E73]" />
          <h3 className="text-sm font-bold text-[#3C230B] uppercase tracking-wider">
            Upcoming Majalis Circles
          </h3>
        </div>

        {upcomingSessions.length === 0 ? (
          <p className="text-xs text-[#8E7E73]">No scheduled upcoming sessions yet.</p>
        ) : (
          <div className="space-y-2.5">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="bg-[#FFFCF5] border border-[#E6DFD5] hover:border-[#D9D0C3] rounded-xl p-4 flex items-center justify-between gap-4 text-xs transition"
              >
                <div>
                  <h4 className="font-semibold text-[#241710]">
                    {session.title}
                  </h4>
                  <p className="text-[11px] text-[#8E7E73] mt-0.5">
                    {session.scheduledAt} • Facilitator: {session.hostName}
                  </p>
                </div>

                <button
                  onClick={() => onJoinMajlis(session.roomId, session.title)}
                  className="px-4 py-2 bg-[#EFECE4] hover:bg-[#E6DFD5] text-[#3C230B] font-semibold rounded-lg transition shrink-0"
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
