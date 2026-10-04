import React from 'react';
import { IslamicStarRosette } from './IslamicStarRosette';

interface SanctuaryLoaderProps {
  message?: string;
  subMessage?: string;
}

export const SanctuaryLoader: React.FC<SanctuaryLoaderProps> = ({
  message = 'Entering Sanctuary...',
  subMessage = 'Connecting hearts and minds in the Majlis',
}) => {
  return (
    <div className="absolute inset-0 z-50 bg-[#120B07] text-[#FFFCF5] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      {/* Background stained glass glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-[#E9A83A]/20 via-[#075E4A]/25 to-[#174A83]/20 blur-3xl rounded-full animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-5 max-w-sm">
        {/* Rotating Star Rosette */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#E9A83A]/10 blur-xl animate-ping" />
          <div className="relative animate-spin duration-3000">
            <IslamicStarRosette size={72} variant="full" className="text-[#E9A83A]" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-[#FFFCF5] tracking-tight">
            {message}
          </h2>
          <p className="text-xs sm:text-sm text-[#C2B2A3] font-normal">
            {subMessage}
          </p>
        </div>

        {/* Loading progress bar indicator */}
        <div className="w-36 h-1 bg-[#2B1B12] rounded-full overflow-hidden border border-[#3A2619]">
          <div className="h-full bg-gradient-to-r from-[#075E4A] via-[#19A6A0] to-[#E9A83A] animate-pulse w-full rounded-full" />
        </div>
      </div>
    </div>
  );
};
