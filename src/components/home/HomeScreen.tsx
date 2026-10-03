import React, { useState } from 'react';
import { Link, PlusCircle, Video } from 'lucide-react';
import { MajlisSession } from '../../types/meeting';

interface HomeScreenProps {
  sessions: MajlisSession[];
  onStartMajlis: () => void;
  onJoinMajlis: (roomId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  sessions,
  onStartMajlis,
  onJoinMajlis,
}) => {
  const [inputCode, setInputCode] = useState('');

  const upcomingSessions = sessions.filter((s) => s.status === 'upcoming' || s.status === 'live');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    onJoinMajlis(inputCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-6 lg:p-12 select-none space-y-10">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
          The Wisdom Lounge
        </span>
        <h2 className="text-3xl font-bold text-[#3C230B] mt-0.5 tracking-tight">
          Majlis
        </h2>
        <p className="text-xs text-[#68594E] mt-1">
          A calm, live space for conversation and learning.
        </p>
      </div>

      {/* Primary Actions (Two prominent options) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        {/* Action 1: Start Majlis */}
        <div className="bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#3C230B]">
              Start Majlis
            </h3>
            <p className="text-xs text-[#68594E]">
              Host a live Majlis immediately or prepare a session.
            </p>
          </div>
          <button
            onClick={onStartMajlis}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] rounded-xl text-xs font-semibold transition"
          >
            <PlusCircle className="w-4 h-4 text-[#E0C2A6]" />
            <span>Start Majlis</span>
          </button>
        </div>

        {/* Action 2: Join Majlis */}
        <div className="bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#3C230B]">
              Join Majlis
            </h3>
            <p className="text-xs text-[#68594E]">
              Enter a Majlis ID or link to join an active session.
            </p>
          </div>
          <form onSubmit={handleJoinSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter Majlis ID..."
              className="flex-1 bg-white border border-[#D9D0C3] rounded-xl px-3 py-2.5 text-xs text-[#241710] font-mono focus:outline-none focus:border-[#3C230B]"
            />
            <button
              type="submit"
              disabled={!inputCode.trim()}
              className="px-4 py-2.5 bg-[#3C230B] hover:bg-[#2B1706] disabled:opacity-40 text-[#FFFCF5] text-xs font-semibold rounded-xl transition"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      {/* Upcoming Majalis List */}
      <div className="space-y-4 max-w-3xl">
        <h3 className="text-sm font-semibold text-[#3C230B]">
          Upcoming
        </h3>

        {upcomingSessions.length === 0 ? (
          <p className="text-xs text-[#8E7E73]">Nothing scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="bg-[#FFFCF5] border border-[#E6DFD5] rounded-xl p-4 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <h4 className="font-semibold text-[#241710]">
                    {session.title}
                  </h4>
                  <p className="text-[11px] text-[#8E7E73] mt-0.5">
                    {session.scheduledAt} • Host: {session.hostName}
                  </p>
                </div>

                <button
                  onClick={() => onJoinMajlis(session.roomId)}
                  className="px-3.5 py-2 bg-[#EFECE4] hover:bg-[#E6DFD5] text-[#3C230B] font-semibold rounded-lg transition"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
