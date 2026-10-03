import React from 'react';
import { MajlisSession } from '../../types/meeting';

interface MajalisScreenProps {
  sessions: MajlisSession[];
  onJoinMajlis: (roomId: string) => void;
  onStartMajlis: () => void;
}

export const MajalisScreen: React.FC<MajalisScreenProps> = ({
  sessions,
  onJoinMajlis,
  onStartMajlis,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-6 lg:p-12 select-none space-y-6">
      <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
            The Wisdom Lounge
          </span>
          <h2 className="text-2xl font-bold text-[#3C230B] mt-0.5">
            Majalis
          </h2>
        </div>
        <button
          onClick={onStartMajlis}
          className="px-4 py-2 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] rounded-xl text-xs font-semibold transition"
        >
          Start Majlis
        </button>
      </div>

      <div className="space-y-3 max-w-3xl">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-[#FFFCF5] border border-[#E6DFD5] rounded-xl p-4 flex items-center justify-between gap-4 text-xs"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[#241710]">
                  {session.title}
                </h3>
                {session.status === 'live' && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Live Now
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8E7E73] mt-0.5">
                {session.scheduledAt} • Host: {session.hostName}
              </p>
            </div>

            <button
              onClick={() => onJoinMajlis(session.roomId)}
              className="px-3.5 py-2 bg-[#EFECE4] hover:bg-[#E6DFD5] text-[#3C230B] font-semibold rounded-lg transition shrink-0"
            >
              {session.status === 'live' ? 'Rejoin Majlis' : 'Join Majlis'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
